<?php

namespace App\Models;

use App\Enums\StatusConciliacao;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Conciliacao extends Model
{
    protected $table = 'reconciliations';
    protected $guarded = ['id'];

    protected $attributes = [
        'status' => 'ABERTA',
    ];

    protected $casts = [
        'status' => StatusConciliacao::class,
        'reference_month' => 'date:Y-m-d',
        'period_start' => 'date:Y-m-d',
        'period_end' => 'date:Y-m-d',
        'statement_balance' => 'decimal:2',
        'statement_balance_date' => 'date:Y-m-d',
        'summary' => 'array',
        'finalized_at' => 'datetime',
        'reopened_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function conta(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'account_id');
    }

    public function itens(): HasMany
    {
        return $this->hasMany(ConciliacaoItem::class, 'reconciliation_id');
    }

    public function isFinalizada(): bool
    {
        return $this->status === StatusConciliacao::FINALIZADA;
    }
}
