<?php

namespace App\Enums;

enum TransactionType: string
{
  case EXPENSE = 'EXPENSE';
  case INCOME = 'INCOME';
}
