<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmprestimoAjuste extends Model
{
    public const AMORTIZACAO = 'AMORTIZACAO';
    public const AUMENTO = 'AUMENTO';

    protected $table = 'loan_adjustments';
    protected $guarded = ['id'];

    protected $casts = [
        'date' => 'date:Y-m-d',
    ];

    public function emprestimo(): BelongsTo
    {
        return $this->belongsTo(Emprestimo::class, 'loan_id');
    }

    public function transacao(): BelongsTo
    {
        return $this->belongsTo(Transacao::class, 'transaction_id');
    }
}
