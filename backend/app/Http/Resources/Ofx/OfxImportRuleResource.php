<?php

namespace App\Http\Resources\Ofx;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfxImportRuleResource extends JsonResource
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
            'conditions' => $this->conditions,
            'actions' => $this->actions,
            'active' => $this->active,
            'vezes_aplicada' => $this->vezes_aplicada,
            'created_at' => $this->created_at,
        ];
    }
}
