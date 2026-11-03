<?php

namespace App\Actions;

use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CriarTransacaoParcelada
{
    public static function executar(int $userId, array $dados): string
    {
        $installmentGroup = (string) Str::uuid();

        // Todas as parcelas compartilham a data da compra: é nela que o valor total entra na competência.
        $dataCompra = $dados['accrual_date']
            ?? collect($dados['parcelas'])
                ->map(fn ($p) => $p['date'] ?? $p['due_date'] ?? null)
                ->filter()
                ->map(fn ($d) => Carbon::parse($d)->toDateString())
                ->min()
            ?? now()->toDateString();

        DB::transaction(function () use ($userId, $dados, $installmentGroup, $dataCompra) {
            foreach ($dados['parcelas'] as $index => $parcela) {
                Transacao::create([
                    'user_id' => $userId,
                    'account_id' => $dados['account_id'],
                    'category_id' => $dados['category_id'] ?? null,
                    'budget_id' => $dados['budget_id'] ?? null,
                    'type' => $dados['type'],
                    'description' => $dados['description'],

                    'amount' => $parcela['amount'],
                    'accrual_date' => $dataCompra,
                    'date' => $parcela['date'] ?? null,
                    'due_date' => $parcela['due_date'] ?? null,
                    'status' => $parcela['status'],

                    'installment_number' => $index + 1,
                    'installment_total' => $dados['installment_total'],
                    'installment_group' => $installmentGroup,
                ]);
            }
        });

        return $installmentGroup;
    }
}
