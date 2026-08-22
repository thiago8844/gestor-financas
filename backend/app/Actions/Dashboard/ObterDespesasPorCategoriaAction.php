<?php

namespace App\Actions\Dashboard;

use App\Queries\Dashboard\TransacoesPorCategoriaQuery;
use Carbon\Carbon;

class ObterDespesasPorCategoriaAction
{
  public static function execute(?Carbon $dataInicial, ?Carbon $dataFinal, ?int $contaId = null): array
  {
    return TransacoesPorCategoriaQuery::run('EXPENSE', $dataInicial, $dataFinal, $contaId);
  }
}
