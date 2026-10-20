<?php

namespace App\Http\Resources;

use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Espera que a relação 'parcelas' já esteja carregada (os totais são calculados sobre ela em memória).
 * Se 'auditorias' também estiver carregada, devolve a auditoria mais recente da fatura.
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
        $resumo = $this->resource->resumoValores($this->parcelas);

        return [
            'id' => $this->id,
            'card_id' => $this->card_id,
            'reference_month' => $this->reference_month?->toDateString(),
            'closing_date' => $this->closing_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'total' => $resumo['total'],
            'pago' => $resumo['pago'],
            'pendente' => $resumo['pendente'],
            'levado_para_proxima' => $resumo['levado_para_proxima'],
            'pagamentos' => $resumo['pagamentos'],
            'status' => $this->calcularStatus($resumo['paga']),
            'auditoria' => $this->when(
                $this->relationLoaded('auditorias'),
                fn () => $this->auditoriaAtual($resumo['total'])
            ),
            'parcelas' => TransacaoResource::collection($this->parcelas),
        ];
    }

    protected function calcularStatus(bool $paga): string
    {
        if ($paga) {
            return 'PAGA';
        }

        $hoje = Carbon::today();

        if ($hoje->gt($this->due_date)) {
            return 'VENCIDA';
        }

        // No próprio dia do fechamento a fatura ainda aceita compras: só fecha no dia seguinte.
        if ($hoje->gt($this->closing_date)) {
            return 'FECHADA';
        }

        return 'ABERTA';
    }

    protected function auditoriaAtual(float $totalAtual): ?array
    {
        $auditoria = $this->auditorias->sortByDesc('id')->first();

        return $auditoria ? AuditoriaFaturaResource::make($auditoria)->comTotalAtual($totalAtual)->resolve() : null;
    }
}
