<?php

namespace App\Queries;

use Illuminate\Support\Facades\DB;
use App\Enums\TransactionType;
use App\Models\User;

class SaldoMedioMensal
{
  public static function calcular(User $user): float
  {
    $entradas = DB::table('transactions')
      ->selectRaw("DATE_FORMAT(date, '%Y-%m') as mes, SUM(amount) as total")
      ->where('user_id', $user->id)
      ->where('type', 'INCOME')
      ->where('date', '>=', DB::raw("DATE_SUB(NOW(), INTERVAL 12 MONTH)"))
      ->groupBy('mes')
      ->pluck('total', 'mes');

    $saidas = DB::table('transactions')
      ->selectRaw("DATE_FORMAT(date, '%Y-%m') as mes, SUM(amount) as total")
      ->where('user_id', $user->id)
      ->where('type', 'EXPENSE')
      ->where('date', '>=', DB::raw("DATE_SUB(NOW(), INTERVAL 12 MONTH)"))
      ->groupBy('mes')
      ->pluck('total', 'mes');

    // Junta todos os meses presentes em entradas ou saídas
    $meses = collect($entradas->keys())->merge($saidas->keys())->unique();

    $saldoMensal = $meses->map(function ($mes) use ($entradas, $saidas) {
      return ($entradas[$mes] ?? 0) - ($saidas[$mes] ?? 0);
    });

    $saldoMedioMensal = $saldoMensal->avg() ?? 0.0;

    return $saldoMedioMensal;
  }
}
