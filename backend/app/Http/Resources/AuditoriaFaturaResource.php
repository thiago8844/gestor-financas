<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * O status sempre compara o total do banco com o total ATUAL da fatura no app (quando informado):
 * assim, ao lançar o ajuste que faltava, a auditoria passa a conferir sem precisar refazê-la.
 */
class AuditoriaFaturaResource extends JsonResource
{
    private ?float $totalAtual = null;

    public function comTotalAtual(float $totalAtual): static
    {
        $this->totalAtual = $totalAtual;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $totalApp = $this->totalAtual ?? (float) $this->app_total;
        $diferenca = round((float) $this->bank_total - $totalApp, 2);

        return [
            'id' => $this->id,
            'invoice_id' => $this->invoice_id,
            'bank_total' => (float) $this->bank_total,
            'app_total' => (float) $this->app_total,
            'difference' => (float) $this->difference,
            'total_atual' => round($totalApp, 2),
            'diferenca_atual' => $diferenca,
            'status' => abs($diferenca) < 0.005 ? 'CONFERE' : 'DIVERGENTE',
            'alterada_depois' => abs($totalApp - (float) $this->app_total) >= 0.005,
            'note' => $this->note,
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
