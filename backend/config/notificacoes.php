<?php

use App\Notificacoes\Regras\FaturaVencidaRegra;

return [
    /*
     * Regras verificadas a cada execução do comando `notificacoes:gerar`.
     * Para adicionar um novo tipo de notificação, crie uma classe que implemente
     * App\Notificacoes\RegraNotificacao e registre ela aqui.
     */
    'regras' => [
        FaturaVencidaRegra::class,
    ],
];
