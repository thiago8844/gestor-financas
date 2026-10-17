<?php

namespace App\Queries\Conciliacao;

use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusItemConciliacao;
use Illuminate\Database\Eloquent\Builder;

/**
 * Contagens das linhas do extrato por situação, para listagens (histórico, painel) sem carregar os itens.
 */
class ContagensConciliacaoQuery
{
    public static function aplicar(Builder $query): Builder
    {
        $extrato = fn ($q) => $q->where('source', OrigemItemConciliacao::EXTRATO->value);
        $comStatus = fn (StatusItemConciliacao $status) => fn ($q) => $extrato($q)->where('status', $status->value);

        return $query->withCount([
            'itens as linhas_count' => $extrato,
            'itens as conciliadas_count' => $comStatus(StatusItemConciliacao::CONCILIADO),
            'itens as pendentes_count' => $comStatus(StatusItemConciliacao::PENDENTE),
            'itens as adiadas_count' => $comStatus(StatusItemConciliacao::ADIADO),
            'itens as ignoradas_count' => $comStatus(StatusItemConciliacao::IGNORADO),
        ]);
    }
}
