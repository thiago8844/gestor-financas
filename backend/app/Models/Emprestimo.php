<?php

namespace App\Models;

use App\Enums\DirecaoEmprestimo;
use App\Enums\FrequenciaEmprestimo;
use App\Enums\ModalidadeEmprestimo;
use App\Enums\PeriodoTaxa;
use App\Enums\StatusEmprestimo;
use App\Enums\TipoJuros;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Emprestimo extends Model
{
    use HasFactory;

    protected $table = 'loans';
    protected $guarded = ['id'];

    protected $casts = [
        'direction' => DirecaoEmprestimo::class,
        'rate_period' => PeriodoTaxa::class,
        'interest_type' => TipoJuros::class,
        'modality' => ModalidadeEmprestimo::class,
        'frequency' => FrequenciaEmprestimo::class,
        'status' => StatusEmprestimo::class,
        'contract_date' => 'date:Y-m-d',
        'first_due_date' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function conta(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'account_id');
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class, 'category_id');
    }

    public function parcelas(): HasMany
    {
        return $this->hasMany(EmprestimoParcela::class, 'loan_id')->orderBy('number');
    }

    public function ajustes(): HasMany
    {
        return $this->hasMany(EmprestimoAjuste::class, 'loan_id')->orderBy('date')->orderBy('id');
    }

    public function eventos(): HasMany
    {
        return $this->hasMany(EmprestimoEvento::class, 'loan_id')->latest('id');
    }

    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'loan_id');
    }

    /** Sem número de parcelas definido: só juros até o contrato ser encerrado. */
    public function prazoAberto(): bool
    {
        return $this->installments === null && $this->modality === ModalidadeEmprestimo::JUROS_PERIODICOS;
    }

    /**
     * Quanto do valor emprestado ainda falta devolver. Contratos de prazo aberto não têm o principal
     * nas parcelas, então ali vale o principal menos as amortizações; nos demais, o que as parcelas
     * em aberto ainda vão amortizar.
     */
    public function saldoPrincipal(): float
    {
        if ($this->prazoAberto()) {
            $amortizado = $this->ajustes->where('type', EmprestimoAjuste::AMORTIZACAO)->sum(fn (EmprestimoAjuste $a) => (float) $a->amount);

            return max(0.0, round((float) $this->principal - $amortizado, 2));
        }

        return round($this->parcelas->sum(fn (EmprestimoParcela $p) => $p->principalRestante()), 2);
    }
}
