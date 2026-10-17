<?php

return [
    /*
     * Diferença máxima de dias entre a data do extrato e a do lançamento no app para considerar
     * que são a mesma movimentação (o banco às vezes posta no dia útil seguinte).
     */
    'tolerancia_dias' => (int) env('CONCILIACAO_TOLERANCIA_DIAS', 4),

    /*
     * Quantos dias antes/depois do mês conciliado procurar faturas para o "é pagamento de fatura".
     */
    'janela_faturas_dias' => 25,

    /*
     * A partir de que dia do mês lembrar de fechar a conciliação do mês anterior (só para contas
     * que já foram conciliadas alguma vez — quem não usa o módulo não é incomodado).
     */
    'lembrete_fechamento_dia' => 5,
];
