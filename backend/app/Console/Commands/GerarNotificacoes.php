<?php

namespace App\Console\Commands;

use App\Actions\Notificacoes\GerarNotificacoes as GerarNotificacoesAction;
use Illuminate\Console\Command;

class GerarNotificacoes extends Command
{
    protected $signature = 'notificacoes:gerar';

    protected $description = 'Verifica as regras de notificação (fatura vencida, etc.) e cria as novas notificações dos usuários.';

    public function handle(GerarNotificacoesAction $action): int
    {
        $criadas = $action->executar();

        $this->info("Notificações criadas: {$criadas}");

        return self::SUCCESS;
    }
}
