<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Cartao extends Model
{
    protected $table = 'cards';
    protected $guarded = ['id'];

    protected $casts = [
        'active' => 'boolean',
        'closing_day' => 'integer',
        'due_day' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function conta(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'account_id');
    }

    public function recorrencias(): HasMany
    {
        return $this->hasMany(RecorrenciaTransacao::class, 'card_id');
    }

    public function faturas(): HasMany
    {
        return $this->hasMany(Fatura::class, 'card_id');
    }
}
