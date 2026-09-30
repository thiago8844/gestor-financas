<?php

namespace App\Actions;

use App\Enums\TransactionStatus;
use App\Models\Cartao;
use App\Models\Categoria;
use App\Models\RecorrenciaTransacao;

class CriarRecorrenciaTransacao
{
    public static function executar(int $userId, array $dados): RecorrenciaTransacao
    {
        $origem = self::resolverOrigem($userId, $dados);

        $recorrencia = new RecorrenciaTransacao([
            'user_id' => $userId,
            ...$origem,
            'category_id' => self::resolverCategoria($userId, $dados),
            'type' => $dados['type'],
            'description' => $dados['description'],
            'amount' => $dados['amount'] ?? null,
            'frequency' => $dados['frequency'],
            'interval' => $dados['interval'],
            'days_of_week' => $dados['days_of_week'] ?? null,
            'day_of_month' => $dados['day_of_month'] ?? null,
            'month_of_year' => $dados['month_of_year'] ?? null,
            'start_date' => $dados['start_date'],
            'end_date' => $dados['end_date'] ?? null,
            'active' => $dados['active'] ?? true,
        ]);

        $recorrencia->next_run_date = $recorrencia->primeiraOcorrencia()->toDateString();
        $recorrencia->save();

        return $recorrencia;
    }

    /**
     * Onde a recorrência lança: numa conta, ou num cartão. No cartão, a conta é sempre a vinculada
     * a ele e a ocorrência nasce PENDENTE — quem baixa é o pagamento da fatura, nunca a recorrência.
     *
     * @return array{account_id: int, card_id: ?int, default_status: string|TransactionStatus}
     */
    public static function resolverOrigem(int $userId, array $dados): array
    {
        if (!empty($dados['card_id'])) {
            $cartao = Cartao::where('user_id', $userId)->findOrFail($dados['card_id']);

            return [
                'account_id' => $cartao->account_id,
                'card_id' => $cartao->id,
                'default_status' => TransactionStatus::PENDING,
            ];
        }

        return [
            'account_id' => $dados['account_id'],
            'card_id' => null,
            'default_status' => $dados['default_status'],
        ];
    }

    public static function resolverCategoria(int $userId, array $dados): ?int
    {
        if (!empty($dados['category_id'])) {
            return $dados['category_id'];
        }

        if (empty($dados['category_name'])) {
            return null;
        }

        $categoria = Categoria::where('user_id', $userId)
            ->where('name', $dados['category_name'])
            ->first();

        if (!$categoria) {
            $categoria = CriarCategoriaTransacao::executar($userId, $dados['category_name']);
        }

        return $categoria->id;
    }
}
