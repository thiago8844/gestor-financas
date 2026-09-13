<?php

namespace App\Support\Orcamentos;

use App\Enums\FrequenciaRecorrencia;
use App\Models\Orcamento;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use RuntimeException;

class CalculadoraPeriodoOrcamento
{
    /**
     * Intervalo [inicio, fim] (fronteiras de calendário) que contém $referencia,
     * de acordo com a frequência do orçamento recorrente.
     *
     * @return array{inicio: Carbon, fim: Carbon}
     */
    public function periodoContendo(Orcamento $orcamento, CarbonInterface $referencia): array
    {
        $referencia = Carbon::parse($referencia)->startOfDay();

        return match ($orcamento->frequency) {
            FrequenciaRecorrencia::WEEKLY => [
                'inicio' => $referencia->copy()->startOfWeek(),
                'fim' => $referencia->copy()->endOfWeek(),
            ],
            FrequenciaRecorrencia::YEARLY => [
                'inicio' => $referencia->copy()->startOfYear(),
                'fim' => $referencia->copy()->endOfYear(),
            ],
            FrequenciaRecorrencia::MONTHLY => $this->periodoMensal($orcamento, $referencia),
            default => throw new RuntimeException('Orçamento sem frequência recorrente válida.'),
        };
    }

    /**
     * @param array{inicio: Carbon, fim: Carbon} $periodoAtual
     * @return array{inicio: Carbon, fim: Carbon}
     */
    public function periodoAnterior(Orcamento $orcamento, array $periodoAtual): array
    {
        return $this->periodoContendo($orcamento, $periodoAtual['inicio']->copy()->subDay());
    }

    /**
     * @param array{inicio: Carbon, fim: Carbon} $periodoAtual
     * @return array{inicio: Carbon, fim: Carbon}
     */
    public function periodoSeguinte(Orcamento $orcamento, array $periodoAtual): array
    {
        return $this->periodoContendo($orcamento, $periodoAtual['fim']->copy()->addDay());
    }

    /**
     * @return array{inicio: Carbon, fim: Carbon}
     */
    private function periodoMensal(Orcamento $orcamento, Carbon $referencia): array
    {
        $intervalo = max(1, (int) $orcamento->interval);

        if ($intervalo <= 1) {
            return [
                'inicio' => $referencia->copy()->startOfMonth(),
                'fim' => $referencia->copy()->endOfMonth(),
            ];
        }

        // Blocos de $intervalo meses ancorados no mês de start_date (ex.: Jan + 3 -> Jan-Mar, Abr-Jun...).
        $ancora = Carbon::parse($orcamento->start_date)->startOfMonth();
        $mesReferencia = $referencia->copy()->startOfMonth();

        $diffMeses = ($mesReferencia->year - $ancora->year) * 12 + ($mesReferencia->month - $ancora->month);
        $indiceBloco = (int) floor($diffMeses / $intervalo);

        $inicioBloco = $ancora->copy()->addMonths($indiceBloco * $intervalo);
        $fimBloco = $inicioBloco->copy()->addMonths($intervalo)->subDay();

        return [
            'inicio' => $inicioBloco->copy()->startOfDay(),
            'fim' => $fimBloco->copy()->endOfDay(),
        ];
    }
}
