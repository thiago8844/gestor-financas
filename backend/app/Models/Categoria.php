<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Categoria extends Model
{
    /** @use HasFactory<\Database\Factories\CategoriaFactory> */
    use HasFactory;

    protected $table = 'categories';
    protected $guarded = ['id'];

    //user, transacoes
    public function user() {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function transacoes() {
        return $this->hasMany(Transacao::class, 'category_id');
    }

    public function qtdTransacoesAttribute(): int {
        //query para pegar a quantidade de transações
        return DB::table('transactions')
        ->where('category_id', $this->id)
        ->where('user_id', $this->user_id)
        ->count();

    }

}
