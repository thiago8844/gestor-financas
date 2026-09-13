<?php

namespace App\Actions\Ofx\Exceptions;

use App\Models\OfxImport;
use Illuminate\Support\Collection;
use RuntimeException;

class OfxDesfazerBloqueadoException extends RuntimeException
{
    /**
     * @param Collection<int, \App\Models\Transacao> $transacoesEditadas
     */
    public function __construct(public readonly OfxImport $importacao, public readonly Collection $transacoesEditadas)
    {
        parent::__construct(
            $transacoesEditadas->isEmpty()
                ? 'Esta importação não pode ser desfeita (não está confirmada).'
                : 'Algumas transações desta importação foram editadas depois de importadas. Confirme para desfazer mesmo assim.'
        );
    }
}
