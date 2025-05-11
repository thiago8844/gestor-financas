<?php

namespace App\Queries;

class SaldoContaQuery
{
    public function getSaldoConta($id)
    {
        return \DB::table('transacao')
            ->select('saldo')
            ->where('id', $id)
            ->first();
    }
}