<?php

namespace App\Http\Resources;

use App\Enums\StatusParcelaEmprestimo;
use App\Models\EmprestimoParcela;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Emprestimo */
class EmprestimoResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $dados = [
            'id' => $this->id,
            'direction' => $this->direction,
            'counterparty' => $this->counterparty,
            'description' => $this->description,
            'principal' => (float) $this->principal,
            'contract_date' => $this->contract_date->toDateString(),
            'rate' => (float) $this->rate,
            'rate_period' => $this->rate_period,
            'interest_type' => $this->interest_type,
            'modality' => $this->modality,
            'frequency' => $this->frequency,
            'due_day' => $this->due_day,
            'due_day_adjustment' => $this->due_day_adjustment,
            'first_due_date' => $this->first_due_date->toDateString(),
            'installments' => $this->installments,
            'grace_installments' => $this->grace_installments,
            'open_term' => $this->prazoAberto(),
            'account_id' => $this->account_id,
            'category_id' => $this->category_id,
            'status' => $this->status,
            'notes' => $this->notes,
            'created_at' => $this->created_at,
            'conta' => $this->whenLoaded('conta'),
            'categoria' => $this->whenLoaded('categoria'),
        ];

        if ($this->relationLoaded('parcelas')) {
            $dados += $this->totais();
            $dados['parcelas'] = EmprestimoParcelaResource::collection($this->parcelas);
        }

        return $dados;
    }

    /** Números de acompanhamento calculados sobre as parcelas carregadas. */
    private function totais(): array
    {
        $validas = $this->parcelas->reject(fn (EmprestimoParcela $p) => $p->status === StatusParcelaEmprestimo::CANCELADA);
        $emAberto = $validas->filter(fn (EmprestimoParcela $p) => $p->emAberto());
        $proxima = $emAberto->sortBy(fn (EmprestimoParcela $p) => $p->due_date->toDateString())->first();

        return [
            'installments_paid' => $validas->where('status', StatusParcelaEmprestimo::PAGA)->count(),
            'installments_total' => $validas->count(),
            'installments_overdue' => $emAberto->filter(fn (EmprestimoParcela $p) => $p->atrasada())->count(),
            'principal_balance' => round($emAberto->sum(fn (EmprestimoParcela $p) => $p->principalRestante()), 2),
            'remaining_total' => round($emAberto->sum(fn (EmprestimoParcela $p) => $p->restante()), 2),
            'paid_total' => round($validas->sum(fn (EmprestimoParcela $p) => (float) $p->paid_amount), 2),
            'interest_total' => round($validas->sum(fn (EmprestimoParcela $p) => (float) $p->interest_amount), 2),
            'next_installment' => $proxima ? EmprestimoParcelaResource::make($proxima) : null,
        ];
    }
}
