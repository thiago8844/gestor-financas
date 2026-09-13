<?php

namespace App\Actions\Ofx\Exceptions;

use App\Models\OfxImport;
use RuntimeException;

class OfxArquivoDuplicadoException extends RuntimeException
{
    public function __construct(public readonly OfxImport $importacaoExistente)
    {
        parent::__construct('Este arquivo já foi importado anteriormente.');
    }
}
