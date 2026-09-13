<?php

namespace App\Http\Resources\Ofx;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OfxImportItemResource extends JsonResource
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
            'ofx_import_id' => $this->ofx_import_id,
            'fitid' => $this->fitid,
            'type' => $this->type,
            'amount' => (float) $this->amount,
            'transaction_date' => $this->transaction_date?->toDateString(),
            'descricao_original' => $this->descricao_original,
            'descricao' => $this->descricao,
            'editada' => $this->foiEditada(),
            'status' => $this->status,
            'selecionada' => $this->selecionada,
            'account_id' => $this->account_id,
            'category_id' => $this->category_id,
            'budget_id' => $this->budget_id,
            'conta' => $this->whenLoaded('conta'),
            'categoria' => $this->whenLoaded('categoria'),
            'orcamento' => $this->whenLoaded('orcamento'),
            'matched_transaction_id' => $this->matched_transaction_id,
            'regra_aplicada_id' => $this->regra_aplicada_id,
            'created_transaction_id' => $this->created_transaction_id,
        ];
    }
}
