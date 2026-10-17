<?php

namespace App\Models;

use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Enums\TransactionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ConciliacaoItem extends Model
{
    protected $table = 'reconciliation_items';
    protected $guarded = ['id'];

    protected $attributes = [
        'source' => 'EXTRATO',
        'status' => 'PENDENTE',
    ];

    protected $casts = [
        'source' => OrigemItemConciliacao::class,
        'status' => StatusItemConciliacao::class,
        'type' => TransactionType::class,
        'amount' => 'decimal:2',
        'transaction_date' => 'date:Y-m-d',
        'resolved_at' => 'datetime',
    ];

    public function conciliacao(): BelongsTo
    {
        return $this->belongsTo(Conciliacao::class, 'reconciliation_id');
    }

    /** Lançamento(s) do app que este item confere (N quando é pagamento de fatura). */
    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'reconciliation_item_id');
    }

    public function fatura(): BelongsTo
    {
        return $this->belongsTo(Fatura::class, 'invoice_id');
    }

    /** Efeito no saldo da conta: entrada positiva, saída negativa. */
    public function valorNoSaldo(): float
    {
        $valor = (float) $this->amount;

        return $this->type === TransactionType::INCOME ? $valor : -$valor;
    }
}
