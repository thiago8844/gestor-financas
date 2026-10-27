<?php

namespace App\Enums;

enum ModalidadeEmprestimo: string
{
    /** Paga só os juros de cada período; o principal volta na última parcela. */
    case JUROS_PERIODICOS = 'JUROS_PERIODICOS';
    /** Parcela fixa (tabela Price). */
    case PRICE = 'PRICE';
    /** Amortização constante, parcela decrescente (SAC). */
    case SAC = 'SAC';
    /** Principal + juros acumulados em uma única data. */
    case PAGAMENTO_UNICO = 'PAGAMENTO_UNICO';
    /** Sem fórmula: o usuário informa cada parcela. */
    case LIVRE = 'LIVRE';
}
