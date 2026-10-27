<?php

namespace App\Actions\Emprestimos;

use App\Enums\StatusEmprestimo;
use App\Enums\StatusParcelaEmprestimo;
use App\Models\Emprestimo;
use App\Models\EmprestimoEvento;
use DomainException;
use Illuminate\Support\Facades\DB;

class CancelarEmprestimo
{
    /**
     * Encerra o contrato sem cobrar o que falta (perdão, desistência, acordo). As parcelas em aberto
     * são canceladas; os lançamentos já feitos na conta e o histórico ficam como estão. Para apagar
     * tudo, inclusive os lançamentos, use ExcluirEmprestimo.
     *
     * @throws DomainException
     */
    public static function executar(Emprestimo $emprestimo, ?string $motivo = null): Emprestimo
    {
        if ($emprestimo->status !== StatusEmprestimo::ATIVO) {
            throw new DomainException(
                $emprestimo->status === StatusEmprestimo::CANCELADO ? 'Este empréstimo já está cancelado.' : 'Este empréstimo já está quitado.',
            );
        }

        return DB::transaction(function () use ($emprestimo, $motivo) {
            $emprestimo->parcelas()->reorder()
                ->whereIn('status', [StatusParcelaEmprestimo::PREVISTA->value, StatusParcelaEmprestimo::PARCIAL->value])
                ->update(['status' => StatusParcelaEmprestimo::CANCELADA->value]);

            $emprestimo->update(['status' => StatusEmprestimo::CANCELADO]);

            EmprestimoEvento::registrar(
                $emprestimo,
                'cancelado',
                'Empréstimo cancelado' . ($motivo ? ": {$motivo}" : ''),
            );

            return $emprestimo->fresh(['parcelas', 'conta:id,name', 'categoria:id,name']);
        });
    }
}
