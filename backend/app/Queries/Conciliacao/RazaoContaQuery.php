<?php

namespace App\Queries\Conciliacao;

use App\Actions\Faturas\PagarFatura;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transacao;
use App\Support\Conciliacao\Dto\EntradaRazao;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * O lado "app" da conciliação: o que já saiu/entrou na conta (lançamentos PAID), no formato em que
 * o banco mostra. A diferença para listar transações é o cartão: as compras de uma fatura são N
 * lançamentos no app, mas o banco mostra um débito só — então viram uma entrada por (fatura, data
 * da baixa), com o valor somado com sinal (estorno e saldo levado para a próxima abatem).
 */
class RazaoContaQuery
{
    /** @return Collection<int, EntradaRazao> */
    public static function entradas(int $userId, int $contaId, Carbon $de, Carbon $ate): Collection
    {
        $transacoes = Transacao::query()
            ->with(['categoria:id,name', 'fatura.cartao:id,name'])
            ->where('user_id', $userId)
            ->where('account_id', $contaId)
            ->where('status', TransactionStatus::PAID)
            ->where('is_initial_balance', false)
            ->whereNotNull('amount')
            ->whereNotNull('date')
            ->whereDate('date', '>=', $de->toDateString())
            ->whereDate('date', '<=', $ate->toDateString())
            ->orderBy('date')
            ->orderBy('id')
            ->get();

        [$deFatura, $avulsas] = $transacoes->partition(fn (Transacao $t) => $t->card_id !== null && $t->invoice_id !== null);

        $entradas = $avulsas->map(fn (Transacao $t) => new EntradaRazao(
            chave: "t:{$t->id}",
            origem: EntradaRazao::ORIGEM_TRANSACAO,
            tipo: $t->type,
            valor: round((float) $t->amount, 2),
            data: $t->date->copy()->startOfDay(),
            descricao: $t->description ?: 'Sem descrição',
            transacaoIds: [$t->id],
            categoria: $t->categoria?->name,
            itemId: $t->reconciliation_item_id,
            transferencia: $t->transfer_id !== null,
        ));

        // Parte já conciliada e parte livre do mesmo pagamento viram entradas separadas.
        $grupos = $deFatura->groupBy(fn (Transacao $t) => $t->invoice_id . '|' . $t->date->toDateString() . '|' . ($t->reconciliation_item_id ?? 0));

        foreach ($grupos as $grupo) {
            $entrada = self::entradaDeFatura($grupo);

            if ($entrada !== null) {
                $entradas->push($entrada);
            }
        }

        return $entradas->sortBy(fn (EntradaRazao $e) => $e->data->toDateString() . $e->chave)->values();
    }

    /**
     * Lançamentos livres (ainda não conciliados) que uma chave representa — o que de fato será
     * vinculado ao item do extrato. Vazio se a chave não existe mais ou já foi conciliada.
     *
     * @return Collection<int, Transacao>
     */
    public static function transacoesDaChave(string $chave, int $userId, int $contaId): Collection
    {
        $base = Transacao::query()
            ->where('user_id', $userId)
            ->where('account_id', $contaId)
            ->where('status', TransactionStatus::PAID)
            ->where('is_initial_balance', false)
            ->whereNull('reconciliation_item_id');

        if (preg_match('/^t:(\d+)$/', $chave, $m)) {
            return $base->where('id', (int) $m[1])
                ->where(fn ($q) => $q->whereNull('card_id')->orWhereNull('invoice_id'))
                ->get();
        }

        if (preg_match('/^f:(\d+):(\d{4}-\d{2}-\d{2})$/', $chave, $m)) {
            return $base->whereNotNull('card_id')
                ->where('invoice_id', (int) $m[1])
                ->whereDate('date', $m[2])
                ->get();
        }

        return collect();
    }

    /** Fatura referida por uma chave de pagamento ("f:{fatura}:{data}"), se for o caso. */
    public static function faturaDaChave(string $chave): ?int
    {
        return preg_match('/^f:(\d+):/', $chave, $m) ? (int) $m[1] : null;
    }

    /** Efeito no saldo da conta de um conjunto de lançamentos (entrada +, saída -). */
    public static function efeitoNoSaldo(Collection $transacoes): float
    {
        return round((float) $transacoes->sum(
            fn (Transacao $t) => $t->type === TransactionType::INCOME ? (float) $t->amount : -(float) $t->amount
        ), 2);
    }

    private static function entradaDeFatura(Collection $grupo): ?EntradaRazao
    {
        /** @var Transacao $primeira */
        $primeira = $grupo->first();
        $efeito = self::efeitoNoSaldo($grupo);

        // Tudo levado para a próxima fatura sem pagar nada: não houve débito no banco.
        if (abs($efeito) < 0.005) {
            return null;
        }

        $data = $primeira->date->copy()->startOfDay();
        $fatura = $primeira->fatura;
        $cartao = $fatura?->cartao?->name ?? 'cartão';
        $mes = $fatura ? ' · ' . PagarFatura::mesAno($fatura->reference_month) : '';
        $itemId = $primeira->reconciliation_item_id;

        return new EntradaRazao(
            chave: "f:{$primeira->invoice_id}:{$data->toDateString()}" . ($itemId ? ":i{$itemId}" : ''),
            origem: EntradaRazao::ORIGEM_FATURA,
            tipo: $efeito < 0 ? TransactionType::EXPENSE : TransactionType::INCOME,
            valor: abs($efeito),
            data: $data,
            descricao: "Pagamento fatura {$cartao}{$mes}",
            transacaoIds: $grupo->pluck('id')->all(),
            faturaId: $primeira->invoice_id,
            itemId: $itemId,
        );
    }
}
