<?php

namespace App\Actions\Emprestimos;

use App\Enums\StatusEmprestimo;
use App\Enums\StatusParcelaEmprestimo;
use App\Models\Emprestimo;
use App\Models\EmprestimoEvento;
use App\Models\EmprestimoParcela;
use Carbon\Carbon;
use DomainException;
use Illuminate\Support\Facades\DB;

class EncerrarEmprestimo
{
    /**
     * Define a data final de um contrato de prazo aberto: cancela as parcelas de juros que
     * ficariam depois dela e cria a parcela final, que devolve o principal.
     *
     * @throws DomainException
     */
    public static function executar(Emprestimo $emprestimo, string $data): Emprestimo
    {
        if (!$emprestimo->prazoAberto() || $emprestimo->status !== StatusEmprestimo::ATIVO) {
            throw new DomainException('Só é possível definir o encerramento de contratos ativos com prazo em aberto.');
        }

        $dataFinal = Carbon::parse($data)->startOfDay();

        return DB::transaction(function () use ($emprestimo, $dataFinal) {
            $emprestimo->parcelas()->reorder()
                ->where('status', StatusParcelaEmprestimo::PREVISTA->value)
                ->whereDate('due_date', '>', $dataFinal->toDateString())
                ->update(['status' => StatusParcelaEmprestimo::CANCELADA->value]);

            $numero = (int) $emprestimo->parcelas()->reorder()->max('number') + 1;

            EmprestimoParcela::create([
                'loan_id' => $emprestimo->id,
                'number' => $numero,
                'due_date' => $dataFinal,
                'principal_amount' => $emprestimo->principal,
                'interest_amount' => 0,
                'expected_amount' => $emprestimo->principal,
                'status' => StatusParcelaEmprestimo::PREVISTA,
            ]);

            // Com o número de parcelas definido, o contrato deixa de ser de prazo aberto.
            $emprestimo->update(['installments' => $numero]);

            EmprestimoEvento::registrar(
                $emprestimo,
                'encerramento_definido',
                'Encerramento definido para ' . $dataFinal->format('d/m/Y'),
            );

            return $emprestimo->fresh('parcelas');
        });
    }
}
