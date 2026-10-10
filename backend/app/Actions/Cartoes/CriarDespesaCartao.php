<?php

namespace App\Actions\Cartoes;

use App\Actions\Faturas\ResolverFaturaCompra;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Cartao;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CriarDespesaCartao
{
    /**
     * Cria uma despesa no cartão, única ou parcelada. Cada parcela é vinculada à fatura do mês
     * correspondente (criando a fatura se necessário) e nasce PENDING — a baixa acontece
     * futuramente pelo pagamento da fatura, não por parcela individual.
     *
     * @return array{installment_group: ?string, transacoes: \Illuminate\Support\Collection<int, Transacao>}
     */
    public static function executar(int $userId, Cartao $cartao, array $dados): array
    {
        $dataCompra = Carbon::parse($dados['purchase_date'])->startOfDay();
        $installmentTotal = max(1, (int) ($dados['installment_total'] ?? 1));
        $valores = static::dividirValor(round((float) $dados['amount'], 2), $installmentTotal);
        $installmentGroup = $installmentTotal > 1 ? (string) Str::uuid() : null;

        $referenciaInicial = ResolverFaturaCompra::referenciaParaCompra($cartao, $dataCompra);

        $transacoes = DB::transaction(function () use ($userId, $cartao, $dados, $dataCompra, $installmentTotal, $installmentGroup, $valores, $referenciaInicial) {
            $criadas = collect();
            $referenciaAtual = $referenciaInicial->copy();

            for ($i = 0; $i < $installmentTotal; $i++) {
                $fatura = ResolverFaturaCompra::localizarOuCriar($cartao, $referenciaAtual);

                $criadas->push(Transacao::create([
                    'user_id' => $userId,
                    'account_id' => $cartao->account_id,
                    'card_id' => $cartao->id,
                    'invoice_id' => $fatura->id,
                    'category_id' => $dados['category_id'] ?? null,
                    'budget_id' => $dados['budget_id'] ?? null,
                    'type' => TransactionType::EXPENSE,
                    'description' => $dados['description'],
                    'amount' => $valores[$i],
                    'purchase_date' => $dataCompra->toDateString(),
                    'due_date' => $fatura->due_date,
                    'date' => null,
                    'status' => TransactionStatus::PENDING,
                    'installment_number' => $installmentTotal > 1 ? $i + 1 : null,
                    'installment_total' => $installmentTotal > 1 ? $installmentTotal : null,
                    'installment_group' => $installmentGroup,
                    'recurring_transaction_id' => $dados['recurring_transaction_id'] ?? null,
                ]));

                $referenciaAtual = $referenciaAtual->copy()->addMonthNoOverflow();
            }

            return $criadas;
        });

        return [
            'installment_group' => $installmentGroup,
            'transacoes' => $transacoes,
        ];
    }

    /**
     * Divide o valor total em N parcelas de centavos, jogando o resto do arredondamento na última.
     *
     * @return array<int, float>
     */
    public static function dividirValor(float $valorTotal, int $total): array
    {
        $centavosTotal = (int) round($valorTotal * 100);
        $base = intdiv($centavosTotal, $total);
        $resto = $centavosTotal - $base * $total;

        return array_map(
            fn (int $i) => round(($base + ($i === $total - 1 ? $resto : 0)) / 100, 2),
            range(0, $total - 1)
        );
    }
}
