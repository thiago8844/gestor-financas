<?php

namespace App\Enums;

enum StatusEmprestimo: string
{
    case ATIVO = 'ATIVO';
    case QUITADO = 'QUITADO';
    case CANCELADO = 'CANCELADO';
}
