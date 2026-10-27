<?php

namespace App\Support\Emprestimos;

use App\Enums\FrequenciaEmprestimo;
use Carbon\Carbon;

/**
 * Calcula a data de vencimento de cada parcela a partir do primeiro vencimento.
 */
class RegraVencimento
{
    public const ULTIMO_DIA_MES = 'ULTIMO_DIA_MES';
    public const PROXIMO_DIA = 'PROXIMO_DIA';
    public const ULTIMO_DIA_UTIL = 'ULTIMO_DIA_UTIL';

    private Carbon $primeiro;

    public function __construct(
        private readonly FrequenciaEmprestimo $frequencia,
        Carbon $primeiroVencimento,
        private readonly ?int $dia = null,
        private readonly string $ajuste = self::ULTIMO_DIA_MES,
    ) {
        $this->primeiro = $primeiroVencimento->copy()->startOfDay();
    }

    /**
     * @param int $indice 0 = primeira parcela
     */
    public function data(int $indice): Carbon
    {
        return match ($this->frequencia) {
            FrequenciaEmprestimo::MENSAL => $this->mensal($indice),
            FrequenciaEmprestimo::QUINZENAL => $this->primeiro->copy()->addDays(14 * $indice),
            FrequenciaEmprestimo::SEMANAL => $this->primeiro->copy()->addDays(7 * $indice),
            FrequenciaEmprestimo::ANUAL => $this->primeiro->copy()->addYearsNoOverflow($indice),
        };
    }

    private function mensal(int $indice): Carbon
    {
        $dia = $this->dia ?? $this->primeiro->day;
        $mes = $this->primeiro->copy()->startOfMonth()->addMonthsNoOverflow($indice);
        $diasNoMes = $mes->daysInMonth;

        if ($dia <= $diasNoMes) {
            $data = $mes->copy()->day($dia);
        } else {
            $data = match ($this->ajuste) {
                self::PROXIMO_DIA => $mes->copy()->addMonthNoOverflow()->startOfMonth(),
                default => $mes->copy()->day($diasNoMes),
            };
        }

        if ($this->ajuste === self::ULTIMO_DIA_UTIL) {
            while ($data->isWeekend()) {
                $data->subDay();
            }
        }

        return $data;
    }
}
