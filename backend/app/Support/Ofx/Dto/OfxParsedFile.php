<?php

namespace App\Support\Ofx\Dto;

use Carbon\Carbon;

final class OfxParsedFile
{
    /**
     * @param OfxParsedTransaction[] $transactions
     * @param ?float $ledgerBalance saldo final informado pelo banco (LEDGERBAL/BALAMT), quando houver
     * @param ?Carbon $ledgerBalanceDate data a que esse saldo se refere (LEDGERBAL/DTASOF)
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
        public readonly ?float $ledgerBalance = null,
        public readonly ?Carbon $ledgerBalanceDate = null,
    ) {
    }
}
