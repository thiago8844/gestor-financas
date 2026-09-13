<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrcamentoLimiteHistorico extends Model
{
    use HasFactory;

    protected $table = 'budget_limit_history';
    protected $guarded = ['id'];

    protected $casts = [
        'amount_limit' => 'decimal:2',
        'effective_from' => 'date:Y-m-d',
    ];

    public function orcamento(): BelongsTo
    {
        return $this->belongsTo(Orcamento::class, 'budget_id');
    }
}
