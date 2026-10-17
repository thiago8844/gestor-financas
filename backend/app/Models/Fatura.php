<?php

namespace App\Models;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class Fatura extends Model
{
    protected $table = 'invoices';
    protected $guarded = ['id'];

    protected $casts = [
        'reference_month' => 'date',
        'closing_date' => 'date',
        'due_date' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function cartao(): BelongsTo
    {
        return $this->belongsTo(Cartao::class, 'card_id');
    }

    public function parcelas(): HasMany
    {
        return $this->hasMany(Transacao::class, 'invoice_id');
    }

    public function auditorias(): HasMany
    {
        return $this->hasMany(AuditoriaFatura::class, 'invoice_id');
    }

    /** Rolagem criada pelo pagamento parcial desta fatura (o saldo que foi para a próxima). */
    public function rolagemDeSaida(): HasMany
    {
        return $this->hasMany(Transferencia::class, 'source_invoice_id');
    }

    /**
     * Totais da fatura, sempre com sinal: compra soma, crédito (estorno) subtrai.
     *
     *  - total: o valor da fatura, como o banco mostra (inclui o saldo recebido da fatura anterior);
     *  - levado_para_proxima: o que não foi pago e rolou para a fatura seguinte (pagamento parcial);
     *  - pago: o que efetivamente saiu da conta (total - levado, quando paga);
     *  - pendente: o que ainda falta pagar;
     *  - pagamentos: cada baixa, por data (é o que aparece como débito no extrato da conta).
     *
     * Com só despesas (todos os dados anteriores ao estorno/rolagem), os números são exatamente
     * os mesmos de antes: soma simples dos valores.
     *
     * @return array{total: float, pago: float, pendente: float, levado_para_proxima: float, paga: bool,
     *               pagamentos: array<int, array{data: string, valor: float}>}
     */
    public function resumoValores(?Collection $parcelas = null): array
    {
        $parcelas ??= $this->parcelas;

        $levadas = $parcelas->filter(fn (Transacao $p) => $p->transfer_id !== null && $p->type === TransactionType::INCOME);
        $daFatura = $parcelas->reject(fn (Transacao $p) => $p->transfer_id !== null && $p->type === TransactionType::INCOME);

        $pagas = $parcelas->where('status', TransactionStatus::PAID);
        $pendentes = $parcelas->where('status', TransactionStatus::PENDING);

        $pagamentos = $pagas
            ->filter(fn (Transacao $p) => $p->date !== null)
            ->groupBy(fn (Transacao $p) => $p->date->toDateString())
            ->map(fn (Collection $grupo, string $data) => [
                'data' => $data,
                'valor' => round((float) $grupo->sum(fn (Transacao $p) => $p->valorNaFatura()), 2),
            ])
            ->sortBy('data')
            ->values()
            ->all();

        return [
            'total' => round((float) $daFatura->sum(fn (Transacao $p) => $p->valorNaFatura()), 2),
            'pago' => round((float) $pagas->sum(fn (Transacao $p) => $p->valorNaFatura()), 2),
            'pendente' => round((float) $pendentes->sum(fn (Transacao $p) => $p->valorNaFatura()), 2),
            'levado_para_proxima' => round((float) $levadas->sum('amount'), 2),
            // Paga = nada com valor esperando pagamento. Crédito pendente também segura a fatura em aberto.
            'paga' => $pendentes->filter(fn (Transacao $p) => (float) ($p->amount ?? 0) > 0)->isEmpty(),
            'pagamentos' => $pagamentos,
        ];
    }

    /**
     * Data da baixa mais recente da fatura (null se nada foi pago).
     */
    public function dataUltimoPagamento(?Collection $parcelas = null): ?string
    {
        $parcelas ??= $this->parcelas;

        return $parcelas->where('status', TransactionStatus::PAID)
            ->filter(fn (Transacao $p) => $p->date !== null)
            ->max(fn (Transacao $p) => $p->date->toDateString());
    }
}
