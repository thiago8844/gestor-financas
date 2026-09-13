<?php

namespace App\Support\Ofx\Dto;

use Carbon\Carbon;

final class OfxParsedFile
{
    /**
     * @param OfxParsedTransaction[] $transactions
     */
    public function __construct(
        public readonly ?string $bankId,
        public readonly ?string $branchId,
        public readonly ?string $acctId,
        public readonly ?string $acctType,
        public readonly ?string $ofxVersion,
        public readonly ?Carbon $periodStart,
        public readonly ?Carbon $periodEnd,
        public readonly array $transactions,
    ) {
    }
}
