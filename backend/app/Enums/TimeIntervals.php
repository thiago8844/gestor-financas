<?php

namespace App\Enums;

enum TimeIntervals: string
{
  case DAILY = 'DAILY';
  case WEEKLY = 'WEEKLY';
  case MONTHLY = 'MONTHLY';
  case THREE_MONTHS = 'THREE_MONTHS';
  case SIX_MONTHS = 'SIX_MONTHS';
  case YEARLY = 'YEARLY';
  case ALL_TIME = 'ALL_TIME';
}
