<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransferenciaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'from_account_id' => $this->from_account_id,
            'to_account_id' => $this->to_account_id,
            'amount' => $this->amount,
            'date' => $this->date?->format('d/m/Y'),
            'date_raw' => $this->date?->toDateString(),
            'description' => $this->description,
            'conta_origem' => $this->whenLoaded('contaOrigem', fn () => [
                'id' => $this->contaOrigem->id,
                'name' => $this->contaOrigem->name,
            ]),
            'conta_destino' => $this->whenLoaded('contaDestino', fn () => [
                'id' => $this->contaDestino->id,
                'name' => $this->contaDestino->name,
            ]),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
