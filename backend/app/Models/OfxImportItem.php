<?php

namespace App\Models;

use App\Enums\OfxImportItemStatus;
use App\Enums\TransactionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OfxImportItem extends Model
{
    protected $table = 'ofx_import_items';
    protected $guarded = ['id'];

    protected $casts = [
        'type' => TransactionType::class,
        'status' => OfxImportItemStatus::class,
        'amount' => 'decimal:2',
        'transaction_date' => 'date:Y-m-d',
        'selecionada' => 'boolean',
    ];

    public function ofxImport(): BelongsTo
    {
        return $this->belongsTo(OfxImport::class, 'ofx_import_id');
    }

    public function conta(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'account_id');
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class, 'category_id');
    }

    public function orcamento(): BelongsTo
    {
        return $this->belongsTo(Orcamento::class, 'budget_id');
    }

    public function transacaoCorrespondente(): BelongsTo
    {
        return $this->belongsTo(Transacao::class, 'matched_transaction_id');
    }

    public function transacaoCriada(): BelongsTo
    {
        return $this->belongsTo(Transacao::class, 'created_transaction_id');
    }

    public function regraAplicada(): BelongsTo
    {
        return $this->belongsTo(OfxImportRule::class, 'regra_aplicada_id');
    }

    public function foiEditada(): bool
    {
        return $this->descricao !== $this->descricao_original;
    }
}
