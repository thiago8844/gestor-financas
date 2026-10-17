<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditoriaFatura extends Model
{
    protected $table = 'invoice_audits';
    protected $guarded = ['id'];

    protected $casts = [
        'bank_total' => 'decimal:2',
        'app_total' => 'decimal:2',
        'difference' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function fatura(): BelongsTo
    {
        return $this->belongsTo(Fatura::class, 'invoice_id');
    }
}
