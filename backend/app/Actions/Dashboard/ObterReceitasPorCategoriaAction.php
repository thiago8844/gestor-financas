<?php

namespace App\Actions\Dashboard;

use App\Queries\Dashboard\TransacoesPorCategoriaQuery;
use Carbon\Carbon;

class ObterReceitasPorCategoriaAction
{
    public static function execute(?Carbon $dataInicial, ?Carbon $dataFinal): array
    {
        return TransacoesPorCategoriaQuery::run('INCOME', $dataInicial, $dataFinal);
    }
}