<?php

namespace App\Actions\Ofx\Exceptions;

use App\Enums\OfxImportStatus;
use App\Models\OfxImport;
use RuntimeException;

class OfxArquivoDuplicadoException extends RuntimeException
{
    public function __construct(public readonly OfxImport $importacaoExistente)
    {
        parent::__construct(
            $importacaoExistente->status === OfxImportStatus::UNDONE
                ? 'Este arquivo já foi importado e desfeito. Reabra a importação existente para revisá-lo novamente.'
                : 'Este arquivo já foi importado anteriormente.'
        );
    }
}
