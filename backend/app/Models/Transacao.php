<?php

namespace App\Models;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transacao extends Model
{

    use HasFactory;

    protected $guarded = ['id'];
    protected $table = 'transactions';

    protected $casts = [
        "type" => TransactionType::class,
        "status" => TransactionStatus::class,
        "date" => 'datetime',
        "due_date" => 'datetime',
        "purchase_date" => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function conta(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'account_id');
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class, 'category_id');
    }

    public function transferencia(): BelongsTo
    {
        return $this->belongsTo(Transferencia::class, 'transfer_id');
    }

    public function recorrencia(): BelongsTo
    {
        return $this->belongsTo(RecorrenciaTransacao::class, 'recurring_transaction_id');
    }

    public function orcamento(): BelongsTo
    {
        return $this->belongsTo(Orcamento::class, 'budget_id');
    }

    public function ofxImport(): BelongsTo
    {
        return $this->belongsTo(OfxImport::class, 'ofx_import_id');
    }

    public function cartao(): BelongsTo
    {
        return $this->belongsTo(Cartao::class, 'card_id');
    }

    public function fatura(): BelongsTo
    {
        return $this->belongsTo(Fatura::class, 'invoice_id');
    }

    public function conciliacaoItem(): BelongsTo
    {
        return $this->belongsTo(ConciliacaoItem::class, 'reconciliation_item_id');
    }

    // -=-=-=- CARTÃO / FATURA -=-=-=-

    /**
     * Quanto este lançamento pesa no total da fatura: compra soma, crédito (estorno ou saldo
     * levado para a próxima fatura) subtrai. Valor nulo (recorrência variável sem valor) conta zero.
     */
    public function valorNaFatura(): float
    {
        $valor = (float) ($this->amount ?? 0);

        return $this->type === TransactionType::INCOME ? -$valor : $valor;
    }

    /**
     * Um dos dois lados da rolagem de um pagamento parcial: o crédito "saldo levado para a
     * próxima fatura" (INCOME) ou o débito "saldo restante da fatura anterior" (EXPENSE).
     */
    public function isRolagemDeFatura(): bool
    {
        return $this->transfer_id !== null && $this->card_id !== null;
    }

    // -=-=-=- PARCELAMENTO -=-=-=-

    public function scopeParcelasDoGrupo($query, string $grupo_uuid)
    {
        return $query->where('installment_group', $grupo_uuid)
            ->orderBy('installment_number');
    }

    public function isPaga(): bool
    {
        return $this->status === TransactionStatus::PAID;
    }

    public function isParcelada(): bool
    {
        return (int) $this->installment_total > 1;
    }

    public static function resumoParcelas(string $grupo): array
    {
        return [
            'total' => static::where('installment_group', $grupo)->sum('amount'),
            'pagas' => static::where('installment_group', $grupo)
                ->where('status', TransactionStatus::PAID)
                ->sum('amount'),
            'pendentes' => static::where('installment_group', $grupo)
                ->where('status', TransactionStatus::PENDING)
                ->sum('amount'),
            'quantidade' => static::where('installment_group', $grupo)->count(),
        ];
    }
}
