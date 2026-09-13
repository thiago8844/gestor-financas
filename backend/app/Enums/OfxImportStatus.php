<?php

namespace App\Enums;

enum OfxImportStatus: string
{
  case STAGED = 'STAGED';
  case CONFIRMED = 'CONFIRMED';
  case UNDONE = 'UNDONE';
}
