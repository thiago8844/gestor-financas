<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RecorrenciaTransacaoResource extends JsonResource
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
            'user_id' => $this->user_id,
            'account_id' => $this->account_id,
            'category_id' => $this->category_id,
            'type' => $this->type,
            'description' => $this->description,
            'amount' => $this->amount,
            'default_status' => $this->default_status,
            'frequency' => $this->frequency,
            'interval' => $this->interval,
            'days_of_week' => $this->days_of_week,
            'day_of_month' => $this->day_of_month,
            'month_of_year' => $this->month_of_year,
            'start_date' => $this->start_date?->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'next_run_date' => $this->next_run_date?->toDateString(),
            'active' => $this->active,
            'last_generated_at' => $this->last_generated_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'categoria' => $this->whenLoaded('categoria'),
            'conta' => $this->whenLoaded('conta'),
        ];
    }
}
