<?php

namespace App\Enums;

enum TransactionStatus: string
{
  case PENDING = 'PENDING';
  case PAID = 'PAID';
}
