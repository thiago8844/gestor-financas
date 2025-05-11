<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Conta extends Model
{
    protected $table = 'conta';
    protected $guarded = ["id"];

    public function getSaldoAttribute() {
        $contaId = $this->id;

        return DB::table('transacao')
            ->selectRaw("
                (
                    SUM(CASE WHEN tipo = 'entrada' THEN valor else 0 END) -
                    SUM(CASE WHEN tipo = 'saida' THEN valor else 0 END)
                ) as saldo
            ")
            ->where('conta_id', $contaId)
            ->value('saldo'); //Pega o valor do saldo
          
    }
}
