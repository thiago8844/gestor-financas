<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Cabeçalho de uma conciliação (sem as linhas). As contagens vêm de withCount, quando a query pedir
 * (ver ContagensConciliacaoQuery).
 */
class ConciliacaoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'account_id' => $this->account_id,
            'conta' => $this->whenLoaded('conta', fn () => ['id' => $this->conta->id, 'name' => $this->conta->name]),
            'reference_month' => $this->reference_month?->format('Y-m'),
            'period_start' => $this->period_start?->toDateString(),
            'period_end' => $this->period_end?->toDateString(),
            'status' => $this->status,
            'original_filename' => $this->original_filename,
            'statement_balance' => $this->statement_balance !== null ? (float) $this->statement_balance : null,
            'statement_balance_date' => $this->statement_balance_date?->toDateString(),
            'note' => $this->note,
            'summary' => $this->summary,
            'finalized_at' => $this->finalized_at?->toDateTimeString(),
            'reopened_at' => $this->reopened_at?->toDateTimeString(),
            'created_at' => $this->created_at?->toDateTimeString(),
            'contagens' => $this->when(isset($this->linhas_count), fn () => [
                'linhas' => (int) $this->linhas_count,
                'conciliadas' => (int) $this->conciliadas_count,
                'pendentes' => (int) $this->pendentes_count,
                'adiadas' => (int) $this->adiadas_count,
                'ignoradas' => (int) $this->ignoradas_count,
            ]),
        ];
    }
}
