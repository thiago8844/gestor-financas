<?php

namespace App\Actions\Emprestimos;

use App\Enums\StatusEmprestimo;
use App\Enums\StatusParcelaEmprestimo;
use App\Models\Emprestimo;
use App\Models\EmprestimoEvento;
use App\Models\EmprestimoParcela;
use DomainException;
use Illuminate\Support\Facades\DB;

class ReverterBaixa
{
    /**
     * Desfaz os pagamentos de uma parcela: remove os lançamentos gerados e volta ela para prevista.
     *
     * @throws DomainException
     */
    public static function executar(Emprestimo $emprestimo, EmprestimoParcela $parcela): EmprestimoParcela
    {
        if ($emprestimo->status === StatusEmprestimo::CANCELADO) {
            throw new DomainException('Este empréstimo está cancelado.');
        }

        if ((float) $parcela->paid_amount <= 0) {
            throw new DomainException('Esta parcela não tem pagamentos para reverter.');
        }

        return DB::transaction(function () use ($emprestimo, $parcela) {
            $parcela->transacoes()->delete();

            $parcela->update([
                'paid_amount' => 0,
                'paid_at' => null,
                'status' => StatusParcelaEmprestimo::PREVISTA,
            ]);

            EmprestimoEvento::registrar(
                $emprestimo,
                'baixa_revertida',
                "Pagamento da parcela {$parcela->number} revertido",
                $parcela->id,
            );

            BaixarParcela::atualizarStatusDoContrato($emprestimo);

            return $parcela->fresh();
        });
    }
}
