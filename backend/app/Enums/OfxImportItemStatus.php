<?php

namespace App\Enums;

enum OfxImportItemStatus: string
{
  case PENDENTE = 'PENDENTE';
  case DUPLICADA = 'DUPLICADA';
  case IGNORADA = 'IGNORADA';
  case IMPORTADA = 'IMPORTADA';
}
