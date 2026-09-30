<?php

namespace App\Http\Resources;

use App\Enums\TransactionStatus;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Espera que a relação 'parcelas' já esteja carregada (os totais são calculados sobre ela em memória).
 */
class FaturaResource extends JsonResource
{
    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $parcelas = $this->parcelas;

        $total = round((float) $parcelas->sum('amount'), 2);
        $pago = round((float) $parcelas->where('status', TransactionStatus::PAID)->sum('amount'), 2);
        $pendente = round($total - $pago, 2);

        return [
            'id' => $this->id,
            'card_id' => $this->card_id,
            'reference_month' => $this->reference_month?->toDateString(),
            'closing_date' => $this->closing_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'total' => $total,
            'pago' => $pago,
            'pendente' => $pendente,
            'status' => $this->calcularStatus($pendente),
            'parcelas' => TransacaoResource::collection($parcelas),
        ];
    }

    protected function calcularStatus(float $pendente): string
    {
        if ($pendente <= 0.0) {
            return 'PAGA';
        }

        $hoje = Carbon::today();

        if ($hoje->gt($this->due_date)) {
            return 'VENCIDA';
        }

        if ($hoje->gte($this->closing_date)) {
            return 'FECHADA';
        }

        return 'ABERTA';
    }
}
