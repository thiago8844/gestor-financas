<?php

namespace App\Models;

use App\Enums\StatusParcelaEmprestimo;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmprestimoParcela extends Model
{
    use HasFactory;

    protected $table = 'loan_installments';
    protected $guarded = ['id'];

    protected $casts = [
        'status' => StatusParcelaEmprestimo::class,
        'due_date' => 'date:Y-m-d',
        'paid_at' => 'date:Y-m-d',
    ];

    public function emprestimo(): BelongsTo
    {
        return $this->belongsTo(Emprestimo::class, 'loan_id');
    }

    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'loan_installment_id');
    }

    public function emAberto(): bool
    {
        return in_array($this->status, [StatusParcelaEmprestimo::PREVISTA, StatusParcelaEmprestimo::PARCIAL], true);
    }

    /** Quanto ainda falta pagar desta parcela. */
    public function restante(): float
    {
        if (!$this->emAberto()) {
            return 0.0;
        }

        return max(0.0, round((float) $this->expected_amount - (float) $this->paid_amount, 2));
    }

    public function atrasada(): bool
    {
        return $this->emAberto() && $this->due_date->lt(now()->startOfDay());
    }

    public function diasEmAtraso(): int
    {
        return $this->atrasada() ? (int) $this->due_date->diffInDays(now()->startOfDay()) : 0;
    }

    /**
     * Principal que esta parcela ainda vai amortizar. Pagamento parcial abate primeiro os juros.
     */
    public function principalRestante(): float
    {
        if (!$this->emAberto()) {
            return 0.0;
        }

        $abatidoDoPrincipal = max(0.0, (float) $this->paid_amount - (float) $this->interest_amount);

        return max(0.0, round((float) $this->principal_amount - $abatidoDoPrincipal, 2));
    }
}
