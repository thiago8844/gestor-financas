<?php

namespace App\Notificacoes;

use App\Enums\DirecaoEmprestimo;
use App\Enums\StatusEmprestimo;
use App\Models\EmprestimoParcela;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Parcelas de empréstimo em aberto de um usuário com vencimento num intervalo de datas.
 */
class ParcelasEmprestimoPorVencimento
{
    /**
     * @return Collection<int, EmprestimoParcela>
     */
    public static function entre(User $user, Carbon $de, Carbon $ate): Collection
    {
        return EmprestimoParcela::whereHas('emprestimo', fn ($q) => $q
                ->where('user_id', $user->id)
                ->where('status', StatusEmprestimo::ATIVO->value))
            ->whereIn('status', ['PREVISTA', 'PARCIAL'])
            ->whereDate('due_date', '>=', $de->toDateString())
            ->whereDate('due_date', '<=', $ate->toDateString())
            ->with('emprestimo')
            ->orderBy('due_date')
            ->get();
    }

    /** "parcela 2/12 do empréstimo com Fulano" / "Fulano deve a parcela 2/12". */
    public static function descricao(EmprestimoParcela $parcela): string
    {
        $emprestimo = $parcela->emprestimo;
        $numero = $emprestimo->installments ? "{$parcela->number}/{$emprestimo->installments}" : (string) $parcela->number;

        return $emprestimo->direction === DirecaoEmprestimo::TOMADO
            ? "A parcela {$numero} do empréstimo com {$emprestimo->counterparty}"
            : "A parcela {$numero} do empréstimo de {$emprestimo->counterparty}";
    }

    public static function dados(EmprestimoParcela $parcela): array
    {
        return [
            'loan_id' => $parcela->loan_id,
            'loan_installment_id' => $parcela->id,
            'direction' => $parcela->emprestimo->direction->value,
            'amount' => $parcela->restante(),
            'due_date' => $parcela->due_date->toDateString(),
        ];
    }
}
