<?php

namespace App\Models;

use App\Enums\FrequenciaRecorrencia;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Support\Recorrencia\CalculadoraProximaOcorrencia;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RecorrenciaTransacao extends Model
{
    use HasFactory;

    protected $table = 'recurring_transactions';
    protected $guarded = ['id'];

    protected $casts = [
        'type' => TransactionType::class,
        'default_status' => TransactionStatus::class,
        'frequency' => FrequenciaRecorrencia::class,
        'days_of_week' => 'array',
        'start_date' => 'date:Y-m-d',
        'end_date' => 'date:Y-m-d',
        'next_run_date' => 'date:Y-m-d',
        'active' => 'boolean',
        'last_generated_at' => 'datetime',
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

    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'recurring_transaction_id');
    }

    public function primeiraOcorrencia(): Carbon
    {
        return (new CalculadoraProximaOcorrencia())->primeiraOcorrencia($this);
    }

    public function proximaOcorrenciaAPartirDe(CarbonInterface $data): Carbon
    {
        return (new CalculadoraProximaOcorrencia())->proximaAPartirDe($this, $data);
    }
}
