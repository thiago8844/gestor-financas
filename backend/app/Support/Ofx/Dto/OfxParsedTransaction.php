<?php

namespace App\Support\Ofx\Dto;

use App\Enums\TransactionType;
use Carbon\Carbon;

final class OfxParsedTransaction
{
    public function __construct(
        public readonly ?string $fitid,
        public readonly Carbon $datePosted,
        public readonly float $amount,
        public readonly TransactionType $type,
        public readonly string $descricaoOriginal,
    ) {
    }
}
