<?php

namespace App\Models;

use App\Enums\OfxImportStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OfxImport extends Model
{
    protected $table = 'ofx_imports';
    protected $guarded = ['id'];

    protected $casts = [
        'status' => OfxImportStatus::class,
        'period_start' => 'date:Y-m-d',
        'period_end' => 'date:Y-m-d',
        'finalizada_at' => 'datetime',
        'undone_at' => 'datetime',
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
        return $this->hasMany(OfxImportItem::class, 'ofx_import_id');
    }

    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'ofx_import_id');
    }

    public function podeDesfazer(): bool
    {
        return $this->status === OfxImportStatus::CONFIRMED;
    }
}
