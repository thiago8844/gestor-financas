<?php

namespace App\Enums;

enum TipoOrcamento: string
{
  case ONE_TIME = 'ONE_TIME';
  case RECURRING = 'RECURRING';
}
