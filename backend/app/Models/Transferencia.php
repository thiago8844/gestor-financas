<?php

namespace App\Models;

use App\Enums\TipoTransferencia;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Transferencia extends Model
{
    protected $table = 'transfers';
    protected $guarded = ['id'];

    // Espelha o default da migration, para o model recém-criado já saber o tipo.
    protected $attributes = [
        'kind' => 'CONTA',
    ];

    protected $casts = [
        'date' => 'date',
        'kind' => TipoTransferencia::class,
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contaOrigem(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'from_account_id');
    }

    public function contaDestino(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'to_account_id');
    }

    public function transacoes(): HasMany
    {
        return $this->hasMany(Transacao::class, 'transfer_id');
    }

    /** Fatura que foi paga parcialmente e mandou o saldo adiante (só para kind = FATURA). */
    public function faturaOrigem(): BelongsTo
    {
        return $this->belongsTo(Fatura::class, 'source_invoice_id');
    }

    /** Fatura que recebeu o saldo restante (só para kind = FATURA). */
    public function faturaDestino(): BelongsTo
    {
        return $this->belongsTo(Fatura::class, 'target_invoice_id');
    }

    /** Só as transferências entre contas, as que o usuário vê e edita na tela de Transferências. */
    public function scopeEntreContas(Builder $query): Builder
    {
        return $query->where('kind', TipoTransferencia::CONTA->value);
    }

    public function isRolagemDeFatura(): bool
    {
        return $this->kind === TipoTransferencia::FATURA;
    }
}
