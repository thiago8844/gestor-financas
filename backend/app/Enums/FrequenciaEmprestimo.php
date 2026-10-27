<?php

namespace App\Enums;

enum FrequenciaEmprestimo: string
{
    case MENSAL = 'MENSAL';
    case QUINZENAL = 'QUINZENAL';
    case SEMANAL = 'SEMANAL';
    case ANUAL = 'ANUAL';

    /** Quantos meses (pode ser fração) dura um período; usado para converter a taxa mensal. */
    public function meses(): float
    {
        return match ($this) {
            self::MENSAL => 1.0,
            self::QUINZENAL => 0.5,
            self::SEMANAL => 12 / 52,
            self::ANUAL => 12.0,
        };
    }
}
