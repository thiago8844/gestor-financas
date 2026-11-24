<?php

namespace App\Observers;

use App\Models\Notificacao;
use App\Support\Push\EnviadorPush;

class NotificacaoObserver
{
    // Só envia o push depois do commit: transação revertida não deve notificar o celular.
    public bool $afterCommit = true;

    public function __construct(private EnviadorPush $enviador)
    {
    }

    public function created(Notificacao $notificacao): void
    {
        $this->enviador->enviar($notificacao);
    }
}
