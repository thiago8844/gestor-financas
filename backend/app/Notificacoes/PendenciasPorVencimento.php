<?php

namespace App\Notificacoes;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Pagamentos pendentes de um usuário com vencimento num intervalo de datas, prontos para
 * virar notificação. Despesas comuns entram uma a uma; as compras de cartão entram agrupadas
 * pela fatura (senão cada compra da fatura geraria a sua própria notificação).
 */
class PendenciasPorVencimento
{
    /**
     * @return Collection<int, array{
     *     chave: string, descricao: string, valor: float, vencimento: Carbon, action_url: string, data: array
     * }>
     */
    public static function entre(User $user, Carbon $de, Carbon $ate): Collection
    {
        // whereDate (e não whereBetween): compara só o dia, independente de a coluna guardar hora ou não.
        $inicio = $de->toDateString();
        $fim = $ate->toDateString();

        $despesas = Transacao::where('user_id', $user->id)
            ->where('type', TransactionType::EXPENSE)
            ->where('status', TransactionStatus::PENDING)
            ->where('is_initial_balance', false)
            ->whereNull('card_id')
            ->whereDate('due_date', '>=', $inicio)
            ->whereDate('due_date', '<=', $fim)
            ->get()
            ->map(fn (Transacao $t) => [
                'chave' => "transacao:{$t->id}",
                'descricao' => "\"{$t->description}\"",
                'valor' => (float) $t->amount,
                'vencimento' => $t->due_date,
                'action_url' => "/despesas/editar/{$t->id}",
                'data' => ['transacao_id' => $t->id],
            ]);

        $faturas = Fatura::where('user_id', $user->id)
            ->whereDate('due_date', '>=', $inicio)
            ->whereDate('due_date', '<=', $fim)
            ->with(['cartao', 'parcelas'])
            ->get()
            ->map(function (Fatura $fatura) {
                // Com sinal: crédito/estorno pendente abate do que falta pagar.
                $pendente = $fatura->resumoValores()['pendente'];

                return [
                    'chave' => "fatura:{$fatura->id}",
                    'descricao' => "A fatura do cartão {$fatura->cartao->name}",
                    'valor' => $pendente,
                    'vencimento' => $fatura->due_date,
                    'action_url' => '/cartoes',
                    'data' => ['fatura_id' => $fatura->id, 'card_id' => $fatura->card_id],
                ];
            })
            ->filter(fn (array $item) => $item['valor'] > 0);

        return $despesas->concat($faturas)->values();
    }

    public static function formatarValor(float $valor): string
    {
        return 'R$ ' . number_format($valor, 2, ',', '.');
    }
}
