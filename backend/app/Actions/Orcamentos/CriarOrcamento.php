<?php

namespace App\Actions\Orcamentos;

use App\Enums\TipoOrcamento;
use App\Models\Orcamento;
use Illuminate\Support\Facades\DB;

class CriarOrcamento
{
    public static function executar(int $userId, array $dados): Orcamento
    {
        return DB::transaction(function () use ($userId, $dados) {
            $orcamento = Orcamento::create([
                'user_id' => $userId,
                'name' => $dados['name'],
                'description' => $dados['description'] ?? null,
                'type' => $dados['type'],
                'amount_limit' => $dados['amount_limit'] ?? null,
                'alert_percentage' => $dados['alert_percentage'] ?? null,
                'ignore_pending_installments' => $dados['ignore_pending_installments'] ?? false,
                'active' => $dados['active'] ?? true,
                'frequency' => $dados['frequency'] ?? null,
                'interval' => $dados['interval'] ?? 1,
                'start_date' => $dados['start_date'] ?? null,
            ]);

            if ($dados['type'] === TipoOrcamento::ONE_TIME->value) {
                foreach ($dados['periodos'] ?? [] as $periodo) {
                    $orcamento->periodos()->create([
                        'start_date' => $periodo['start_date'],
                        'end_date' => $periodo['end_date'],
                    ]);
                }
            }

            return $orcamento->fresh(['periodos']);
        });
    }
}
