<?php

namespace App\Support\Relatorios;

use App\Enums\ComparacaoRelatorio;
use Carbon\Carbon;
use Carbon\CarbonInterface;

/**
 * Calcula o intervalo de datas "comparável" a um período informado, para
 * responder perguntas como "18% em relação ao mês anterior" no relatório.
 */
class PeriodoComparacao
{
    /**
     * @return array{inicio: Carbon, fim: Carbon}|null null quando $modo é NENHUM
     */
    public function calcular(
        CarbonInterface $dataInicial,
        CarbonInterface $dataFinal,
        ComparacaoRelatorio $modo
    ): ?array {
        if ($modo === ComparacaoRelatorio::NENHUM) {
            return null;
        }

        // Período de meses fechados (ex.: setembro, últimos 3 meses, ano): compara com meses
        // fechados também. Recuar por dias deixaria o dia 1º de fora (setembro tem 30 dias,
        // então "30 dias antes" começaria em 02/08) e sumiria, por exemplo, com o salário do dia 1.
        if ($this->ehMesesFechados($dataInicial, $dataFinal)) {
            $meses = $dataInicial->diffInMonths($dataFinal->copy()->addDay());

            return match ($modo) {
                ComparacaoRelatorio::PERIODO_ANTERIOR => [
                    'inicio' => Carbon::instance($dataInicial)->subMonthsNoOverflow($meses)->startOfDay(),
                    'fim' => Carbon::instance($dataInicial)->subDay()->startOfDay(),
                ],
                ComparacaoRelatorio::MESMO_PERIODO_ANO_ANTERIOR => [
                    'inicio' => Carbon::instance($dataInicial)->subYearNoOverflow()->startOfDay(),
                    'fim' => Carbon::instance($dataFinal)->subYearNoOverflow()->endOfMonth()->startOfDay(),
                ],
            };
        }

        return match ($modo) {
            // Desloca o intervalo inteiro para trás pelo mesmo número de dias que ele tem,
            // então funciona para um período personalizado qualquer.
            ComparacaoRelatorio::PERIODO_ANTERIOR => (function () use ($dataInicial, $dataFinal) {
                $duracaoDias = $dataInicial->diffInDays($dataFinal) + 1;
                $fim = $dataInicial->copy()->subDay();
                $inicio = $fim->copy()->subDays($duracaoDias - 1);

                return ['inicio' => $inicio, 'fim' => $fim];
            })(),

            ComparacaoRelatorio::MESMO_PERIODO_ANO_ANTERIOR => [
                'inicio' => $dataInicial->copy()->subYear(),
                'fim' => $dataFinal->copy()->subYear(),
            ],
        };
    }

    /** Começa no dia 1º e termina no último dia de algum mês. */
    private function ehMesesFechados(CarbonInterface $dataInicial, CarbonInterface $dataFinal): bool
    {
        return $dataInicial->day === 1
            && $dataFinal->isSameDay($dataFinal->copy()->endOfMonth());
    }
}
