<?php

namespace App\Actions\Ofx\Exceptions;

use App\Models\OfxImport;
use RuntimeException;

class OfxImportacaoJaFinalizadaException extends RuntimeException
{
    public function __construct(public readonly OfxImport $importacao)
    {
        parent::__construct('Esta importação já foi confirmada ou desfeita anteriormente.');
    }
}
