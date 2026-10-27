<?php

namespace App\Enums;

enum DirecaoEmprestimo: string
{
    /** Eu devo: dinheiro que peguei emprestado. As parcelas são despesas. */
    case TOMADO = 'TOMADO';
    /** Me devem: dinheiro que emprestei. As parcelas são receitas. */
    case CONCEDIDO = 'CONCEDIDO';

    public function tipoTransacao(): TransactionType
    {
        return $this === self::TOMADO ? TransactionType::EXPENSE : TransactionType::INCOME;
    }

    /** Tipo do lançamento do principal na contratação (entra na conta de quem toma, sai de quem empresta). */
    public function tipoTransacaoContratacao(): TransactionType
    {
        return $this === self::TOMADO ? TransactionType::INCOME : TransactionType::EXPENSE;
    }
}
