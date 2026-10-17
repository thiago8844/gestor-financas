<?php

namespace App\Actions\Faturas\Exceptions;

use RuntimeException;

/**
 * Regra de negócio da fatura que impede a operação (vira 422 com a mensagem para o usuário).
 */
class OperacaoFaturaException extends RuntimeException
{
}
