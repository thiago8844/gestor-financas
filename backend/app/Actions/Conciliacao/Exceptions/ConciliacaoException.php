<?php

namespace App\Actions\Conciliacao\Exceptions;

use RuntimeException;

/**
 * Regra da conciliação que impede a operação. Vira resposta JSON com a mensagem, o status HTTP
 * e, se houver, dados extras para a tela reagir (ex.: necessita_conta, diferenca).
 */
class ConciliacaoException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422, public readonly array $dados = [])
    {
        parent::__construct($message);
    }
}
