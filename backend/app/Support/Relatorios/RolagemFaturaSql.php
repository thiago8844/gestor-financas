<?php

namespace App\Support\Relatorios;

/**
 * Pagamento parcial de fatura gera dois lançamentos de rolagem (ver PagarFatura): um crédito na
 * fatura paga ("saldo levado para a próxima") e um débito na seguinte ("saldo restante").
 *
 * Relatórios de consumo (resultado, análise de gastos, categorias...) ignoram os dois pelo
 * transfer_id, como já fazem com transferências. Já os relatórios de caixa/saldo precisam deles —
 * é o que faz o mês da fatura mostrar só o que saiu da conta —, mas o crédito não é uma "entrada"
 * de dinheiro: ele diminui a saída do mês. Estas expressões fazem essa conta.
 *
 * Para dados sem rolagem (tudo que existia antes dela), o resultado é idêntico ao SUM simples.
 */
class RolagemFaturaSql
{
    /** Condição SQL: o lançamento é o crédito da rolagem (abate da saída, não é entrada). */
    public static function credito(string $prefixo = ''): string
    {
        return "({$prefixo}type = 'INCOME' AND {$prefixo}transfer_id IS NOT NULL AND {$prefixo}card_id IS NOT NULL)";
    }

    public static function somaEntradas(string $prefixo = ''): string
    {
        return "SUM(CASE WHEN {$prefixo}type = 'INCOME' AND NOT " . self::credito($prefixo) . " THEN {$prefixo}amount ELSE 0 END)";
    }

    public static function somaSaidas(string $prefixo = ''): string
    {
        return "SUM(CASE WHEN {$prefixo}type = 'EXPENSE' THEN {$prefixo}amount WHEN " . self::credito($prefixo) . " THEN -{$prefixo}amount ELSE 0 END)";
    }
}
