<?php

namespace App\Support\Recorrencia;

use App\Enums\FrequenciaRecorrencia;
use App\Models\RecorrenciaTransacao;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use RuntimeException;

class CalculadoraProximaOcorrencia
{
    /**
     * Primeira data válida (>= start_date) para a recorrência.
     */
    public function primeiraOcorrencia(RecorrenciaTransacao $recorrencia): Carbon
    {
        $inicio = Carbon::parse($recorrencia->start_date)->startOfDay();

        return $this->primeiraValidaAPartirDe($recorrencia, $inicio);
    }

    /**
     * Primeira data válida estritamente depois de $data.
     */
    public function proximaAPartirDe(RecorrenciaTransacao $recorrencia, CarbonInterface $data): Carbon
    {
        $apartirDe = Carbon::parse($data)->startOfDay()->addDay();

        return $this->primeiraValidaAPartirDe($recorrencia, $apartirDe);
    }

    private function primeiraValidaAPartirDe(RecorrenciaTransacao $recorrencia, Carbon $desde): Carbon
    {
        return match ($recorrencia->frequency) {
            FrequenciaRecorrencia::DAILY => $this->proximaDiaria($recorrencia, $desde),
            FrequenciaRecorrencia::WEEKLY => $this->proximaSemanal($recorrencia, $desde),
            FrequenciaRecorrencia::MONTHLY => $this->proximaMensal($recorrencia, $desde),
            FrequenciaRecorrencia::YEARLY => $this->proximaAnual($recorrencia, $desde),
        };
    }

    private function proximaDiaria(RecorrenciaTransacao $recorrencia, Carbon $desde): Carbon
    {
        $inicio = Carbon::parse($recorrencia->start_date)->startOfDay();
        $intervalo = max(1, (int) $recorrencia->interval);

        if ($desde->lte($inicio)) {
            return $inicio->copy();
        }

        $diasDesdeInicio = $inicio->diffInDays($desde);
        $resto = $diasDesdeInicio % $intervalo;
        $diasParaSomar = $resto === 0 ? 0 : ($intervalo - $resto);

        return $desde->copy()->addDays($diasParaSomar);
    }

    private function proximaSemanal(RecorrenciaTransacao $recorrencia, Carbon $desde): Carbon
    {
        $inicio = Carbon::parse($recorrencia->start_date)->startOfDay();
        $dias = collect($recorrencia->days_of_week ?? [])
            ->map(fn ($dia) => (int) $dia)
            ->values();

        if ($dias->isEmpty()) {
            throw new RuntimeException('Recorrência semanal sem dias da semana configurados.');
        }

        $cursor = $desde->lt($inicio) ? $inicio->copy() : $desde->copy();

        for ($i = 0; $i < 7; $i++) {
            if ($dias->contains($cursor->dayOfWeek)) {
                return $cursor;
            }

            $cursor = $cursor->addDay();
        }

        throw new RuntimeException('Não foi possível calcular a próxima ocorrência semanal.');
    }

    private function proximaMensal(RecorrenciaTransacao $recorrencia, Carbon $desde): Carbon
    {
        $inicio = Carbon::parse($recorrencia->start_date)->startOfDay();
        $intervalo = max(1, (int) $recorrencia->interval);
        $dia = (int) $recorrencia->day_of_month;

        $cursor = $inicio->copy();
        $candidato = $this->diaDoMesClamp($cursor, $dia);

        while ($candidato->lt($desde)) {
            $cursor = $cursor->addMonthsNoOverflow($intervalo);
            $candidato = $this->diaDoMesClamp($cursor, $dia);
        }

        return $candidato;
    }

    private function proximaAnual(RecorrenciaTransacao $recorrencia, Carbon $desde): Carbon
    {
        $inicio = Carbon::parse($recorrencia->start_date)->startOfDay();
        $intervalo = max(1, (int) $recorrencia->interval);
        $dia = (int) $recorrencia->day_of_month;
        $mes = (int) $recorrencia->month_of_year;

        $cursor = $inicio->copy();
        $candidato = $this->diaDoAnoClamp($cursor, $mes, $dia);

        while ($candidato->lt($desde)) {
            $cursor = $cursor->addYears($intervalo);
            $candidato = $this->diaDoAnoClamp($cursor, $mes, $dia);
        }

        return $candidato;
    }

    private function diaDoMesClamp(Carbon $referencia, int $dia): Carbon
    {
        $diasNoMes = $referencia->daysInMonth;

        return Carbon::create($referencia->year, $referencia->month, min($dia, $diasNoMes))->startOfDay();
    }

    private function diaDoAnoClamp(Carbon $referencia, int $mes, int $dia): Carbon
    {
        $diasNoMes = Carbon::create($referencia->year, $mes, 1)->daysInMonth;

        return Carbon::create($referencia->year, $mes, min($dia, $diasNoMes))->startOfDay();
    }
}
