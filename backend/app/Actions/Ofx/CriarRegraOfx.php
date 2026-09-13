<?php

namespace App\Actions\Ofx;

use App\Models\OfxImportRule;

class CriarRegraOfx
{
    public static function executar(int $userId, array $dados): OfxImportRule
    {
        return OfxImportRule::create([
            'user_id' => $userId,
            'name' => $dados['name'] ?? $dados['descricao_contains'],
            'conditions' => array_filter([
                'descricao_contains' => $dados['descricao_contains'],
                'tipo' => $dados['tipo'] ?? null,
            ], fn ($valor) => !is_null($valor)),
            'actions' => array_filter([
                'descricao' => $dados['descricao'] ?? null,
                'category_id' => $dados['category_id'] ?? null,
                'budget_id' => $dados['budget_id'] ?? null,
            ], fn ($valor) => !is_null($valor)),
            'active' => true,
        ]);
    }
}
