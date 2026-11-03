<?php

namespace App\Enums;

enum RegraFechamentoCartao: string
{
    case DIA_FIXO = 'FIXED_DAY';
    case DIAS_ANTES_VENCIMENTO = 'DAYS_BEFORE_DUE';
}
