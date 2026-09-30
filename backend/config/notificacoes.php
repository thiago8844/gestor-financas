<?php

use App\Notificacoes\Regras\DespesaVencidaRegra;
use App\Notificacoes\Regras\PagamentoAVencerRegra;

return [
    /*
     * Regras verificadas a cada execução do comando `notificacoes:gerar`.
     * Para adicionar um novo tipo de notificação, crie uma classe que implemente
     * App\Notificacoes\RegraNotificacao e registre ela aqui.
     * Os prazos de cada regra vêm das configurações do usuário (tela de Configurações).
     */
    'regras' => [
        PagamentoAVencerRegra::class,
        DespesaVencidaRegra::class,
    ],
];
