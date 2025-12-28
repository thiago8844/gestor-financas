<?php

namespace App\Queries;

use Illuminate\Support\Facades\DB;
use App\Enums\TransactionType;
use App\Models\User;

class TendenciaSaldo
{
  public static function calcular(User $user): float
  {
    $saldos = collect();
    for ($i = 11; $i >= 0; $i--) {
      $fimMes = now()->subMonths($i)->endOfMonth()->toDateString();

      $entradas = DB::table('transactions')
        ->where('user_id', $user->id)
        ->where('type', 'INCOME')
        ->where('date', '<=', $fimMes)
        ->sum('amount');

      $saidas = DB::table('transactions')
        ->where('user_id', $user->id)
        ->where('type', 'EXPENSE')
        ->where('date', '<=', $fimMes)
        ->sum('amount');

      $saldos->push($entradas - $saidas);
    }

    // Calcula a variação percentual mês a mês
    $variacoes = [];
    for ($i = 1; $i < $saldos->count(); $i++) {
      $anterior = $saldos[$i - 1];
      $atual = $saldos[$i];
      if ($anterior != 0) {
        $variacoes[] = ($atual - $anterior) / abs($anterior);
      }
    }

    // Retorna a média das variações em porcentagem
    if (count($variacoes) === 0) {
      return 0.0;
    }
    
    return round(array_sum($variacoes) / count($variacoes) * 100, 2);
  }
}
