<?php

namespace App\Enums;

/**
 * EXTRATO: linha que veio do OFX. APP: lançamento que só existe no app e que o usuário
 * confirmou que está certo mesmo sem aparecer no extrato.
 */
enum OrigemItemConciliacao: string
{
    case EXTRATO = 'EXTRATO';
    case APP = 'APP';
}
