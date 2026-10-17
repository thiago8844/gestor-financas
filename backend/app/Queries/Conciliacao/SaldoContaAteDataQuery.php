<?php

namespace App\Queries\Conciliacao;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Saldo da conta no app ao fim de um dia: mesma regra do SaldoContaQuery (receitas - despesas
 * pagas, inclusive o saldo inicial), mas só com o que tem data até o dia informado. É o número
 * comparado com o saldo final que o banco manda no OFX.
 */
class SaldoContaAteDataQuery
{
    public static function calcular(int $contaId, Carbon $data): float
    {
        $saldo = DB::table('transactions')
            ->where('account_id', $contaId)
            ->where('status', TransactionStatus::PAID->value)
            ->whereNotNull('date')
            ->whereDate('date', '<=', $data->toDateString())
            ->selectRaw("COALESCE(SUM(CASE WHEN type = '" . TransactionType::INCOME->value . "' THEN amount ELSE -amount END), 0) AS saldo")
            ->value('saldo');

        return round((float) $saldo, 2);
    }
}
