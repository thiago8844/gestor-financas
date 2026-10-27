<?php

namespace App\Actions\Emprestimos;

use App\Actions\CriarRecorrenciaTransacao;
use App\Enums\DirecaoEmprestimo;
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
use InvalidArgumentException;
use Illuminate\Support\Facades\DB;

class CriarEmprestimo
{
    public const CATEGORIA_PADRAO = 'Empréstimos';

    /**
     * @throws InvalidArgumentException quando os parâmetros não geram um cronograma válido
     */
    public static function executar(int $userId, array $dados): Emprestimo
    {
        $contrato = ContratoEmprestimo::dosDados($dados);
        $parcelas = (new GeradorCronograma())->gerar($contrato);

        self::validarParcelasLivres($contrato, $parcelas);

        return DB::transaction(function () use ($userId, $dados, $contrato, $parcelas) {
            $emprestimo = Emprestimo::create([
                'user_id' => $userId,
                'direction' => $dados['direction'],
                'counterparty' => $dados['counterparty'],
                'description' => $dados['description'] ?? null,
                'principal' => $dados['principal'],
                'contract_date' => $dados['contract_date'],
                'rate' => $contrato->taxa,
                'rate_period' => $dados['rate_period'] ?? 'MES',
                'interest_type' => $dados['interest_type'] ?? 'SIMPLES',
                'modality' => $dados['modality'],
                'frequency' => $dados['frequency'] ?? 'MENSAL',
                'due_day' => $dados['due_day'] ?? null,
                'due_day_adjustment' => $dados['due_day_adjustment'] ?? 'ULTIMO_DIA_MES',
                'first_due_date' => $dados['first_due_date'],
                'installments' => $contrato->modalidade === ModalidadeEmprestimo::LIVRE
                    ? count($parcelas)
                    : ($contrato->modalidade === ModalidadeEmprestimo::PAGAMENTO_UNICO ? 1 : $contrato->parcelas),
                'grace_installments' => $contrato->carencia,
                'account_id' => $dados['account_id'] ?? null,
                'category_id' => CriarRecorrenciaTransacao::resolverCategoria($userId, [
                    'category_id' => $dados['category_id'] ?? null,
                    'category_name' => $dados['category_name'] ?? self::CATEGORIA_PADRAO,
                ]),
                'status' => StatusEmprestimo::ATIVO,
                'notes' => $dados['notes'] ?? null,
            ]);

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
            ], $parcelas));

            EmprestimoEvento::registrar($emprestimo, 'criado', 'Empréstimo criado');

            if (!empty($dados['movimentar_conta'])) {
                self::lancarPrincipal($emprestimo);
            }

            return $emprestimo->load('parcelas');
        });
    }

    /**
     * Lança o principal na conta: entra para quem tomou, sai para quem emprestou.
     */
    private static function lancarPrincipal(Emprestimo $emprestimo): void
    {
        if (!$emprestimo->account_id) {
            throw new InvalidArgumentException('Informe a conta para movimentar o valor do empréstimo.');
        }

        $tomado = $emprestimo->direction === DirecaoEmprestimo::TOMADO;

        Transacao::create([
            'user_id' => $emprestimo->user_id,
            'account_id' => $emprestimo->account_id,
            'category_id' => $emprestimo->category_id,
            'loan_id' => $emprestimo->id,
            'type' => $emprestimo->direction->tipoTransacaoContratacao(),
            'status' => TransactionStatus::PAID,
            'amount' => $emprestimo->principal,
            'description' => $tomado
                ? "Empréstimo recebido de {$emprestimo->counterparty}"
                : "Empréstimo concedido a {$emprestimo->counterparty}",
            'date' => $emprestimo->contract_date,
            'due_date' => $emprestimo->contract_date,
        ]);

        EmprestimoEvento::registrar($emprestimo, 'principal_lancado', 'Valor do empréstimo lançado na conta');
    }

    /** No modo livre o usuário monta o cronograma; o principal precisa fechar com o valor emprestado. */
    private static function validarParcelasLivres(ContratoEmprestimo $contrato, array $parcelas): void
    {
        if ($contrato->modalidade !== ModalidadeEmprestimo::LIVRE) {
            return;
        }

        $soma = round(array_sum(array_column($parcelas, 'valor_principal')), 2);

        if (abs($soma - round($contrato->principal, 2)) > 0.009) {
            throw new InvalidArgumentException('A soma do principal das parcelas deve ser igual ao valor emprestado.');
        }
    }
}
