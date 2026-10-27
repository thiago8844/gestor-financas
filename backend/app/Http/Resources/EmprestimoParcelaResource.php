<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\EmprestimoParcela */
class EmprestimoParcelaResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'loan_id' => $this->loan_id,
            'number' => $this->number,
            'due_date' => $this->due_date->toDateString(),
            'principal_amount' => (float) $this->principal_amount,
            'interest_amount' => (float) $this->interest_amount,
            'expected_amount' => (float) $this->expected_amount,
            'paid_amount' => (float) $this->paid_amount,
            'remaining_amount' => $this->restante(),
            'paid_at' => $this->paid_at?->toDateString(),
            'status' => $this->status,
            'overdue' => $this->atrasada(),
            'days_overdue' => $this->diasEmAtraso(),
        ];
    }
}
