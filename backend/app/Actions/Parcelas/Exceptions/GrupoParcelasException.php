<?php

namespace App\Actions\Parcelas\Exceptions;

use RuntimeException;

/**
 * Regra de negócio do grupo de parcelas que impede a operação (vira 422 com a mensagem para o usuário).
 */
class GrupoParcelasException extends RuntimeException
{
}
