<?php

namespace App\Actions\Emprestimos;

use App\Actions\CriarRecorrenciaTransacao;
use App\Enums\ModalidadeEmprestimo;
use App\Models\Emprestimo;
use App\Models\EmprestimoEvento;
use App\Support\Emprestimos\ContratoEmprestimo;
use App\Support\Emprestimos\GeradorCronograma;
use DomainException;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class RefazerContratoEmprestimo
{
    /**
     * Refaz as condições do contrato (valor, taxa, prazo, vencimentos): substitui o cronograma e o
     * lançamento do principal. Só vale enquanto o contrato não teve baixas nem ajustes.
     *
     * @throws DomainException quando o contrato já teve movimentação
     * @throws InvalidArgumentException quando os parâmetros não geram um cronograma válido
     */
    public static function executar(Emprestimo $emprestimo, array $dados): Emprestimo
    {
        if (!$emprestimo->contratoEditavel()) {
            throw new DomainException(
                'As condições só podem ser editadas enquanto o empréstimo está ativo e sem pagamentos ou ajustes. '
                . 'Desfaça as baixas ou exclua e registre de novo.'
            );
        }

        $contrato = ContratoEmprestimo::dosDados($dados);
        $parcelas = (new GeradorCronograma())->gerar($contrato);

        CriarEmprestimo::validarParcelasLivres($contrato, $parcelas);

        return DB::transaction(function () use ($emprestimo, $dados, $contrato, $parcelas) {
            $emprestimo->transacoes()->whereNull('loan_installment_id')->delete();
            $emprestimo->parcelas()->reorder()->delete();

            $emprestimo->update([
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
                'category_id' => CriarRecorrenciaTransacao::resolverCategoria($emprestimo->user_id, [
                    'category_id' => $dados['category_id'] ?? $emprestimo->category_id,
                    'category_name' => $dados['category_name'] ?? CriarEmprestimo::CATEGORIA_PADRAO,
                ]),
                'notes' => $dados['notes'] ?? null,
            ]);

            CriarEmprestimo::inserirParcelas($emprestimo, $parcelas);

            EmprestimoEvento::registrar($emprestimo, 'contrato_editado', 'Condições do contrato editadas');

            if (!empty($dados['movimentar_conta'])) {
                CriarEmprestimo::lancarPrincipal($emprestimo->refresh());
            }

            return $emprestimo->load('parcelas');
        });
    }
}
