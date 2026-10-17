<?php

namespace App\Support\Conciliacao\Dto;

use App\Enums\TransactionType;
use Carbon\Carbon;

/** Linha do extrato bancário, já normalizada, para o Conciliador. */
final class LinhaExtrato
{
    public function __construct(
        public readonly int $id,
        public readonly TransactionType $tipo,
        public readonly float $valor,
        public readonly Carbon $data,
        public readonly string $descricao,
    ) {
    }
}
