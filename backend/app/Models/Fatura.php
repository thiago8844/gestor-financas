<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Fatura extends Model
{
    protected $table = 'invoices';
    protected $guarded = ['id'];

    protected $casts = [
        'reference_month' => 'date',
        'closing_date' => 'date',
        'due_date' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cartao(): BelongsTo
    {
        return $this->belongsTo(Cartao::class, 'card_id');
    }

    public function parcelas(): HasMany
    {
        return $this->hasMany(Transacao::class, 'invoice_id');
    }
}
