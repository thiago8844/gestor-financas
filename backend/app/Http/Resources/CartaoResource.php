<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CartaoResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            "id" => $this->id,
            "name" => $this->name,
            "account_id" => $this->account_id,
            "conta_nome" => $this->whenLoaded('conta', fn () => $this->conta->name),
            "closing_day" => $this->closing_day,
            "due_day" => $this->due_day,
            "active" => $this->active,
            "created_at" => $this->created_at,
            "updated_at" => $this->updated_at,
        ];
    }
}
