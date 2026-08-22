<?php

namespace App\Actions\Dashboard;

use App\Queries\Dashboard\TransacoesPorCategoriaQuery;
use Carbon\Carbon;

class ObterReceitasPorCategoriaAction
{
    public static function execute(?Carbon $dataInicial, ?Carbon $dataFinal, ?int $contaId = null): array
    {
        return TransacoesPorCategoriaQuery::run('INCOME', $dataInicial, $dataFinal, $contaId);
    }
}
