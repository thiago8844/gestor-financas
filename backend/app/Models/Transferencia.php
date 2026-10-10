<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transferencia extends Model
{
    protected $table = 'transfers';
    protected $guarded = ['id'];

    protected $casts = [
        'date' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contaOrigem(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'from_account_id');
    }

    public function contaDestino(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'to_account_id');
    }

    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'transfer_id');
    }
}
