<?php

namespace App\Actions;

use App\Models\Transacao;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CriarTransacaoParcelada
{
    public static function executar(int $userId, array $dados): string
    {
        $installmentGroup = (string) Str::uuid();

        DB::transaction(function () use ($userId, $dados, $installmentGroup) {
            foreach ($dados['parcelas'] as $index => $parcela) {
                Transacao::create([
                    'user_id' => $userId,
                    'account_id' => $dados['account_id'],
                    'category_id' => $dados['category_id'] ?? null,
                    'type' => $dados['type'],
                    'description' => $dados['description'],

                    'amount' => $parcela['amount'],
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
