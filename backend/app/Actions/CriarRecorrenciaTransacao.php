<?php

namespace App\Actions;

use App\Models\Categoria;
use App\Models\RecorrenciaTransacao;

class CriarRecorrenciaTransacao
{
    public static function executar(int $userId, array $dados): RecorrenciaTransacao
    {
        $recorrencia = new RecorrenciaTransacao([
            'user_id' => $userId,
            'account_id' => $dados['account_id'],
            'category_id' => self::resolverCategoria($userId, $dados),
            'type' => $dados['type'],
            'description' => $dados['description'],
            'amount' => $dados['amount'] ?? null,
            'default_status' => $dados['default_status'],
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
