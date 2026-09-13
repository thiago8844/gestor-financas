<?php

namespace App\Actions\Ofx\Exceptions;

use App\Support\Ofx\Dto\OfxParsedFile;
use RuntimeException;

class OfxContaNaoInformadaException extends RuntimeException
{
    public function __construct(public readonly OfxParsedFile $arquivo, public readonly string $accountHash)
    {
        parent::__construct('Não foi possível identificar automaticamente a conta para esta importação. Selecione a conta de destino.');
    }
}
