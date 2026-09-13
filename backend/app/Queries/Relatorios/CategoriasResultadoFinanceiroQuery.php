<?php

namespace App\Queries\Relatorios;

use App\Models\Transacao;
use App\Support\Relatorios\FiltrosResultadoFinanceiro;
use Illuminate\Support\Collection;

class CategoriasResultadoFinanceiroQuery
{
    /**
     * Lançamentos do tipo informado, agrupados por categoria — cada linha já traz
     * os lançamentos daquela categoria embutidos (drill-down: Categoria → Transação).
     *
     * @return Collection<int, array{categoria_id: int|null, categoria: string, total: float, transacoes: Collection}>
     */
    public static function query(FiltrosResultadoFinanceiro $filtros, string $tipo): Collection
    {
        $colunaData = $filtros->colunaData();

        $transacoes = Transacao::query()
            ->where('user_id', $filtros->userId)
            ->where('is_initial_balance', false)
            ->where('type', $tipo)
            ->whereIn('status', $filtros->statuses())
            ->when($filtros->contaId, fn ($q) => $q->where('account_id', $filtros->contaId))
            ->whereRaw("DATE({$colunaData}) BETWEEN ? AND ?", [
                $filtros->dataInicial->toDateString(),
                $filtros->dataFinal->toDateString(),
            ])
            ->with(['categoria', 'conta', 'orcamento'])
            ->orderByDesc('amount')
            ->get();

        return $transacoes
            ->groupBy('category_id')
            ->map(function (Collection $grupo) {
                $primeira = $grupo->first();

                return [
                    'categoria_id' => $primeira->category_id,
                    'categoria' => $primeira->categoria->name ?? 'Sem categoria',
                    'total' => round((float) $grupo->sum('amount'), 2),
                    'transacoes' => $grupo->values(),
                ];
            })
            ->sortByDesc('total')
            ->values();
    }
}
