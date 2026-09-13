<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransacaoResource extends JsonResource
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
            'amount' => $this->amount,
            'type' => $this->type,
            'status' => $this->status,
            'date' => $this->date?->format('d/m/Y H:i'),
            'date_raw' => $this->date,
            'due_date' => $this->due_date?->format('d/m/Y H:i'),
            'due_date_raw' => $this->due_date,
            'description' => $this->description,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'categoria' => $this->whenLoaded('categoria'),
            'conta' => $this->whenLoaded('conta'),
            'installment_number' => $this->installment_number,
            'installment_total' => $this->installment_total,
            'installment_group' => $this->installment_group,
            'is_installment' => (int) $this->installment_total > 1,
            'recurring_transaction_id' => $this->recurring_transaction_id,
            'is_recurring' => !is_null($this->recurring_transaction_id),
            'budget_id' => $this->budget_id,
            'orcamento' => $this->whenLoaded('orcamento'),
        ];
    }
}
