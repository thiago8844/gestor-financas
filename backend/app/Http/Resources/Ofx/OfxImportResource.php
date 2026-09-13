<?php

namespace App\Http\Resources\Ofx;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfxImportResource extends JsonResource
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
            'original_filename' => $this->original_filename,
            'ofx_version' => $this->ofx_version,
            'status' => $this->status,
            'period_start' => $this->period_start?->toDateString(),
            'period_end' => $this->period_end?->toDateString(),
            'total_transactions' => $this->total_transactions,
            'imported_transactions' => $this->imported_transactions,
            'duplicate_transactions' => $this->duplicate_transactions,
            'ignored_transactions' => $this->ignored_transactions,
            'finalizada_at' => $this->finalizada_at,
            'undone_at' => $this->undone_at,
            'pode_desfazer' => $this->podeDesfazer(),
            'account_id' => $this->account_id,
            'conta' => $this->whenLoaded('conta'),
            'itens' => OfxImportItemResource::collection($this->whenLoaded('itens')),
            'created_at' => $this->created_at,
        ];
    }
}
