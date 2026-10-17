<?php

namespace App\Enums;

/**
 * CONTA: transferência de verdade entre duas contas do usuário (tela de Transferências).
 * FATURA: rolagem de saldo entre duas faturas do mesmo cartão, criada pelo pagamento parcial.
 * As duas são movimentação interna — não é ganhar nem gastar —, por isso compartilham o
 * transfer_id que os relatórios já excluem.
 */
enum TipoTransferencia: string
{
    case CONTA = 'CONTA';
    case FATURA = 'FATURA';
}
