<?php

namespace App\Models;

use App\Queries\SaldoContaQuery;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Conta extends Model
{
    /** @use HasFactory<\Database\Factories\ContaFactory> */
    use HasFactory;

    protected $table = 'accounts';
    protected $guarded = ['id'];
    protected $appends = ['saldo'];

    public function getSaldoAttribute(): float
    {
        return SaldoContaQuery::calcularSaldo($this->id);
    }

    public function getSaldoInicialTransactionAttribute(): Transacao
    {
        return Transacao::where('account_id', $this->id)
            ->where('is_initial_balance', true)
            ->first();
    }

    public function getSaldoInicialAttribute(): float
    {
        return (float) ($this->saldo_inicial_transaction?->amount ?? 0);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
