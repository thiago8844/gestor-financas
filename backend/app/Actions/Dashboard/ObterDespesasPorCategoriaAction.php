<?php

namespace App\Actions\Dashboard;

use App\Queries\Dashboard\TransacoesPorCategoriaQuery;
use Carbon\Carbon;

class ObterDespesasPorCategoriaAction
{
  public static function execute(?Carbon $dataInicial, ?Carbon $dataFinal): array
  {
    return TransacoesPorCategoriaQuery::run('EXPENSE', $dataInicial, $dataFinal);
  }
}
