<?php

namespace App\Actions\Ofx\Exceptions;

use App\Models\OfxImport;
use RuntimeException;

class OfxReabrirBloqueadoException extends RuntimeException
{
    public function __construct(public readonly OfxImport $importacao)
    {
        parent::__construct('Só é possível reabrir importações desfeitas.');
    }
}
