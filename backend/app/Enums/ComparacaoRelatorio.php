<?php

namespace App\Enums;

enum ComparacaoRelatorio: string
{
  case NENHUM = 'NENHUM';
  case PERIODO_ANTERIOR = 'PERIODO_ANTERIOR';
  case MESMO_PERIODO_ANO_ANTERIOR = 'MESMO_PERIODO_ANO_ANTERIOR';
}
