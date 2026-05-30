<?php

namespace App\Queries;

use Illuminate\Support\Facades\DB;
use App\Enums\TransactionType;

class SaldoContaQuery
{
  public static function calcularSaldo(int $contaId): float
  {
    // Soma as transações do tipo INCOME
    $income = DB::table('transactions')
      ->where('account_id', $contaId)
      ->where('type', TransactionType::INCOME->value)
      ->where('status', 'PAID')
      ->sum('amount');

    // Soma as transações do tipo EXPENSE
    $expense = DB::table('transactions')
      ->where('account_id', $contaId)
      ->where('type', TransactionType::EXPENSE->value)
      ->where('status', 'PAID')
      ->sum('amount');

    // Calcula o saldo: INCOME - EXPENSE
    return (float) ($income - $expense);
  }
}
