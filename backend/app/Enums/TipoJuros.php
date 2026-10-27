<?php

namespace App\Enums;

enum TipoJuros: string
{
    case SIMPLES = 'SIMPLES';
    case COMPOSTO = 'COMPOSTO';
    case SEM_JUROS = 'SEM_JUROS';
}
