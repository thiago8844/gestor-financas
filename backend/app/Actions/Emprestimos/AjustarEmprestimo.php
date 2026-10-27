<?php

namespace App\Actions\Emprestimos;

use App\Enums\DirecaoEmprestimo;
use App\Enums\StatusEmprestimo;
use App\Enums\StatusParcelaEmprestimo;
use App\Enums\TransactionStatus;
use App\Models\Emprestimo;
use App\Models\EmprestimoAjuste;
use App\Models\EmprestimoEvento;
use App\Models\EmprestimoParcela;
use App\Models\Transacao;
use App\Support\Emprestimos\CalculadoraAjuste;
use Carbon\Carbon;
use DomainException;
use Illuminate\Support\Facades\DB;

class AjustarEmprestimo
{
    /**
     * Aplica uma amortização extra ou um aumento do empréstimo: refaz as parcelas futuras e lança a
     * movimentação na conta.
     *
     * @param array{type: string, amount: float|string, date?: ?string, mode?: ?string, installments?: ?int, account_id?: ?int, movimentar_conta?: ?bool} $dados
     * @throws DomainException
     */
    public static function executar(Emprestimo $emprestimo, array $dados): Emprestimo
    {
        $calculadora = new CalculadoraAjuste();
        $tipo = $dados['type'];
        $amortizacao = $tipo === EmprestimoAjuste::AMORTIZACAO;
        $valor = round((float) $dados['amount'], 2);
        $data = Carbon::parse($dados['date'] ?? now())->startOfDay();
        $modo = $dados['mode'] ?? CalculadoraAjuste::MANTER_PRAZO;

        // A amortização sempre mexe na conta; no aumento, dá para registrar só o contrato.
        $movimentar = $amortizacao || ($dados['movimentar_conta'] ?? true);
        $contaId = $dados['account_id'] ?? $emprestimo->account_id;

        if ($movimentar && !$contaId) {
            throw new DomainException('Informe a conta para lançar a movimentação.');
        }

        $plano = $calculadora->calcular($emprestimo, $tipo, $valor, $data, $modo, $dados['installments'] ?? null);

        return DB::transaction(function () use ($emprestimo, $plano, $tipo, $amortizacao, $valor, $data, $modo, $movimentar, $contaId) {
            $emprestimo->parcelas()->reorder()->whereIn('id', $plano['futuras']->pluck('id'))->delete();

            $agora = now();
            EmprestimoParcela::insert(array_map(fn (array $p) => [
                'loan_id' => $emprestimo->id,
                'number' => $p['numero'],
                'due_date' => $p['vencimento']->toDateString(),
                'principal_amount' => $p['valor_principal'],
                'interest_amount' => $p['valor_juros'],
                'expected_amount' => $p['valor_previsto'],
                'status' => StatusParcelaEmprestimo::PREVISTA->value,
                'created_at' => $agora,
                'updated_at' => $agora,
            ], $plano['novas']));

            $transacao = $movimentar ? self::lancar($emprestimo, $plano['valor_a_lancar'], $contaId, $data, $amortizacao) : null;

            EmprestimoAjuste::create([
                'loan_id' => $emprestimo->id,
                'type' => $tipo,
                'date' => $data,
                'amount' => $valor,
                'accrued_interest' => $plano['juros_proporcionais'],
                'mode' => $modo,
                'balance_before' => $plano['saldo_antes'],
                'balance_after' => $plano['saldo_depois'],
                'transaction_id' => $transacao?->id,
            ]);

            if (!$amortizacao) {
                $emprestimo->principal = round((float) $emprestimo->principal + $valor, 2);
            }

            if (!$emprestimo->prazoAberto()) {
                $maiorNumero = $emprestimo->parcelas()->reorder()
                    ->where('status', '!=', StatusParcelaEmprestimo::CANCELADA->value)
                    ->max('number');
                $emprestimo->installments = $maiorNumero ? (int) $maiorNumero : $emprestimo->installments;
            }

            $emprestimo->save();

            $real = number_format($valor, 2, ',', '.');
            EmprestimoEvento::registrar(
                $emprestimo,
                $amortizacao ? 'amortizacao' : 'aumento',
                $amortizacao
                    ? "Amortização extra de R$ {$real}" . ($plano['juros_proporcionais'] > 0 ? ' (mais R$ ' . number_format($plano['juros_proporcionais'], 2, ',', '.') . ' de juros proporcionais)' : '')
                    : "Empréstimo aumentado em R$ {$real}",
                null,
                ['amount' => $valor, 'balance_before' => $plano['saldo_antes'], 'balance_after' => $plano['saldo_depois']],
            );

            self::atualizarStatus($emprestimo, $amortizacao);

            return $emprestimo->fresh(['parcelas', 'conta:id,name', 'categoria:id,name']);
        });
    }

    private static function lancar(Emprestimo $emprestimo, float $valor, int|string $contaId, Carbon $data, bool $amortizacao): Transacao
    {
        $tipo = $amortizacao ? $emprestimo->direction->tipoTransacao() : $emprestimo->direction->tipoTransacaoContratacao();
        $tomado = $emprestimo->direction === DirecaoEmprestimo::TOMADO;

        $descricao = $amortizacao
            ? ($tomado ? "Amortização do empréstimo com {$emprestimo->counterparty}" : "Amortização recebida de {$emprestimo->counterparty}")
            : ($tomado ? "Aumento do empréstimo com {$emprestimo->counterparty}" : "Aumento do empréstimo para {$emprestimo->counterparty}");

        return Transacao::create([
            'user_id' => $emprestimo->user_id,
            'account_id' => $contaId,
            'category_id' => $emprestimo->category_id,
            'loan_id' => $emprestimo->id,
            'type' => $tipo,
            'status' => TransactionStatus::PAID,
            'amount' => $valor,
            'description' => $descricao,
            'date' => $data,
            'due_date' => $data,
        ]);
    }

    /** Quita quando a amortização zerou tudo; reabre um contrato quitado que recebeu aumento. */
    private static function atualizarStatus(Emprestimo $emprestimo, bool $amortizacao): void
    {
        if (!$amortizacao && $emprestimo->status === StatusEmprestimo::QUITADO) {
            $emprestimo->update(['status' => StatusEmprestimo::ATIVO]);
            EmprestimoEvento::registrar($emprestimo, 'reaberto', 'Empréstimo reaberto');

            return;
        }

        BaixarParcela::atualizarStatusDoContrato($emprestimo);
    }
}
