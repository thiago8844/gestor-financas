<?php

namespace App\Enums;

enum FrequenciaRecorrencia: string
{
  case DAILY = 'DAILY';
  case WEEKLY = 'WEEKLY';
  case MONTHLY = 'MONTHLY';
  case YEARLY = 'YEARLY';
}
