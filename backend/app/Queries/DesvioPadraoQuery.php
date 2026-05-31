<?php

namespace App\Queries;

use Illuminate\Support\Facades\DB;
use App\Enums\TransactionType;
use App\Models\User;

class DesvioPadraoQuery
{


  public static function calcular(User $user, TransactionType $tipo): float
  {
    $despesasMensais = DB::table('transactions')
      ->selectRaw("DATE_FORMAT(date, '%Y-%m') as mes, SUM(amount) as total")
      ->where('user_id', $user->id)
      ->where('type', $tipo)
      ->where('date', '>=', DB::raw("DATE_SUB(NOW(), INTERVAL 12 MONTH)"))
      ->groupBy('mes')
      ->pluck('total')
      ->toArray();

    $media = array_sum($despesasMensais) / (count($despesasMensais) ?: 1);

    $variancia = array_sum(array_map(
      fn($valor) => pow($valor - $media, 2),
      $despesasMensais
    )) / (count($despesasMensais) ?: 1);

    return $desvioPadrao = sqrt($variancia);
  }
}
