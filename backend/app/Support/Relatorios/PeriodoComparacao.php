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
        return match ($modo) {
            ComparacaoRelatorio::NENHUM => null,

            // Desloca o intervalo inteiro para trás pelo mesmo número de dias que ele tem,
            // então funciona tanto para um mês fechado quanto para um período personalizado.
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
}
