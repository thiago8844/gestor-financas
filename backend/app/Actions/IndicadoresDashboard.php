<?php

namespace App\Actions;

class CriarCategoriaTransacao
{
    public static function executar(int $userId, string $categoryName)
    {
        return \App\Models\Categoria::create([
            'user_id' => $userId,
            'name' => $categoryName,
        ]);
    }
}