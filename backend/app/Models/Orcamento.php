<?php

namespace App\Models;

use App\Enums\FrequenciaRecorrencia;
use App\Enums\TipoOrcamento;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Orcamento extends Model
{
    use HasFactory;

    protected $table = 'budgets';
    protected $guarded = ['id'];

    protected $casts = [
        'type' => TipoOrcamento::class,
        'frequency' => FrequenciaRecorrencia::class,
        'amount_limit' => 'decimal:2',
        'alert_percentage' => 'integer',
        'ignore_pending_installments' => 'boolean',
        'active' => 'boolean',
        'interval' => 'integer',
        'start_date' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function periodos(): HasMany
    {
        return $this->hasMany(OrcamentoPeriodo::class, 'budget_id')->orderBy('start_date');
    }

    public function historicoLimite(): HasMany
    {
        return $this->hasMany(OrcamentoLimiteHistorico::class, 'budget_id');
    }

    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'budget_id');
    }

    public function isRecorrente(): bool
    {
        return $this->type === TipoOrcamento::RECURRING;
    }

    /**
     * Limite vigente numa determinada data: pega a linha de histórico mais recente
     * com effective_from <= $data; se não houver nenhuma, cai no limite original do orçamento.
     */
    public function limiteEm(CarbonInterface $data): ?float
    {
        $linha = $this->historicoLimite()
            ->where('effective_from', '<=', $data->toDateString())
            ->orderByDesc('effective_from')
            ->first();

        $valor = $linha ? $linha->amount_limit : $this->amount_limit;

        return is_null($valor) ? null : (float) $valor;
    }
}
