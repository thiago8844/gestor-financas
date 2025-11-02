<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ContaResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $transacaoInicial = $this->saldo_inicial_transaction;
        
        return [
            "id" => $this->id,
            "name" => $this->name,
            "currency" => $this->currency,
            "include_in_networth" => $this->include_in_networth,
            "type" => $this->type,
            "role" => $this->role,
            "instituicao" => $this->instituicao,
            "saldo_inicial" => $transacaoInicial->amount,
            "data_saldo_inicial" => $transacaoInicial->date,
        ];
    }
}
