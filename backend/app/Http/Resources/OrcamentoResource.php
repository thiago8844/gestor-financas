<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrcamentoResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'type' => $this->type,
            'amount_limit' => $this->amount_limit === null ? null : (float) $this->amount_limit,
            'alert_percentage' => $this->alert_percentage,
            'ignore_pending_installments' => $this->ignore_pending_installments,
            'active' => $this->active,
            'frequency' => $this->frequency,
            'interval' => $this->interval,
            'start_date' => $this->start_date?->toDateString(),
            'periodos' => $this->whenLoaded('periodos', fn () => $this->periodos->map(fn ($periodo) => [
                'id' => $periodo->id,
                'start_date' => $periodo->start_date->toDateString(),
                'end_date' => $periodo->end_date->toDateString(),
            ])),
            'created_at' => $this->created_at,
        ];
    }
}
