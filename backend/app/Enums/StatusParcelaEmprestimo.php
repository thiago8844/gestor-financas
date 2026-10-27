<?php

namespace App\Enums;

enum StatusParcelaEmprestimo: string
{
    case PREVISTA = 'PREVISTA';
    case PARCIAL = 'PARCIAL';
    case PAGA = 'PAGA';
    case CANCELADA = 'CANCELADA';
}
