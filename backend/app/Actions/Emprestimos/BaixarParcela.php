<?php

namespace App\Actions\Emprestimos;

use App\Enums\ModalidadeEmprestimo;
use App\Enums\StatusEmprestimo;
use App\Enums\StatusParcelaEmprestimo;
use App\Enums\TransactionStatus;
use App\Models\Emprestimo;
use App\Models\EmprestimoEvento;
use App\Models\EmprestimoParcela;
use App\Models\Transacao;
use App\Support\Emprestimos\ContratoEmprestimo;
use App\Support\Emprestimos\GeradorCronograma;
use Carbon\Carbon;
use DomainException;
use Illuminate\Support\Facades\DB;

class BaixarParcela
{
    /** Em contratos de prazo aberto, quantas parcelas em aberto manter à frente. */
    private const MINIMO_PARCELAS_A_FRENTE = 6;
    private const PARCELAS_A_GERAR = 12;

    /**
     * Registra o pagamento (ou recebimento) de uma parcela e lança a movimentação na conta.
     *
     * @param array{amount?: float|string|null, paid_at?: string|null, account_id?: int|string|null} $dados
     * @throws DomainException
     */
    public static function executar(Emprestimo $emprestimo, EmprestimoParcela $parcela, array $dados = []): EmprestimoParcela
    {
        if (!$parcela->emAberto()) {
            throw new DomainException('Esta parcela não está em aberto.');
        }

        $restante = $parcela->restante();
        $valor = round((float) ($dados['amount'] ?? $restante), 2);

        if ($valor <= 0) {
            throw new DomainException('O valor deve ser maior que zero.');
        }

        if ($valor > $restante + 0.009) {
            throw new DomainException('O valor é maior que o restante da parcela.');
        }

        $contaId = $dados['account_id'] ?? $emprestimo->account_id;

        if (!$contaId) {
            throw new DomainException('Informe a conta para lançar o pagamento.');
        }

        $data = Carbon::parse($dados['paid_at'] ?? now())->startOfDay();

        return DB::transaction(function () use ($emprestimo, $parcela, $valor, $contaId, $data) {
            $quitada = abs(($valor) - $parcela->restante()) < 0.01;
            $tipo = $emprestimo->direction->tipoTransacao();

            Transacao::create([
                'user_id' => $emprestimo->user_id,
                'account_id' => $contaId,
                'category_id' => $emprestimo->category_id,
                'loan_id' => $emprestimo->id,
                'loan_installment_id' => $parcela->id,
                'type' => $tipo,
                'status' => TransactionStatus::PAID,
                'amount' => $valor,
                'description' => self::descricao($emprestimo, $parcela),
                'date' => $data,
                'due_date' => $parcela->due_date,
            ]);

            $parcela->update([
                'paid_amount' => round((float) $parcela->paid_amount + $valor, 2),
                'paid_at' => $data,
                'status' => $quitada ? StatusParcelaEmprestimo::PAGA : StatusParcelaEmprestimo::PARCIAL,
            ]);

            EmprestimoEvento::registrar(
                $emprestimo,
                $quitada ? 'parcela_paga' : 'parcela_paga_parcial',
                ($quitada ? 'Parcela ' : 'Pagamento parcial da parcela ') . $parcela->number . ' - R$ ' . number_format($valor, 2, ',', '.'),
                $parcela->id,
                ['amount' => $valor, 'paid_at' => $data->toDateString()],
            );

            self::atualizarStatusDoContrato($emprestimo);
            self::estenderPrazoAberto($emprestimo);

            return $parcela->fresh();
        });
    }

    public static function descricao(Emprestimo $emprestimo, EmprestimoParcela $parcela): string
    {
        $total = $emprestimo->installments ? "/{$emprestimo->installments}" : '';
        $verbo = $emprestimo->direction->value === 'TOMADO' ? 'Empréstimo' : 'Recebimento de empréstimo';

        return "{$verbo} {$emprestimo->counterparty} - parcela {$parcela->number}{$total}";
    }

    /** Quita o contrato quando não sobra nenhuma parcela em aberto (e não é de prazo aberto). */
    public static function atualizarStatusDoContrato(Emprestimo $emprestimo): void
    {
        if ($emprestimo->status === StatusEmprestimo::CANCELADO || $emprestimo->prazoAberto()) {
            return;
        }

        $emAberto = $emprestimo->parcelas()->reorder()
            ->whereIn('status', [StatusParcelaEmprestimo::PREVISTA->value, StatusParcelaEmprestimo::PARCIAL->value])
            ->exists();

        $novo = $emAberto ? StatusEmprestimo::ATIVO : StatusEmprestimo::QUITADO;

        if ($emprestimo->status !== $novo) {
            $emprestimo->update(['status' => $novo]);
            EmprestimoEvento::registrar(
                $emprestimo,
                $novo === StatusEmprestimo::QUITADO ? 'quitado' : 'reaberto',
                $novo === StatusEmprestimo::QUITADO ? 'Empréstimo quitado' : 'Empréstimo reaberto',
            );
        }
    }

    /** Contratos de prazo aberto nunca ficam sem parcelas futuras: gera mais conforme as antigas são pagas. */
    private static function estenderPrazoAberto(Emprestimo $emprestimo): void
    {
        if (!$emprestimo->prazoAberto() || $emprestimo->status !== StatusEmprestimo::ATIVO) {
            return;
        }

        $emAberto = $emprestimo->parcelas()->reorder()->where('status', StatusParcelaEmprestimo::PREVISTA->value)->count();

        if ($emAberto >= self::MINIMO_PARCELAS_A_FRENTE) {
            return;
        }

        $ultimo = (int) $emprestimo->parcelas()->reorder()->max('number');
        $gerar = (new GeradorCronograma())->gerar(
            ContratoEmprestimo::dosDados($emprestimo->getAttributes()),
            $ultimo + self::PARCELAS_A_GERAR,
        );

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
        ], array_values(array_filter($gerar, fn (array $p) => $p['numero'] > $ultimo))));
    }
}
