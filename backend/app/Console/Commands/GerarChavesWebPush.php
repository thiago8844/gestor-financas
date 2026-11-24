<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

class GerarChavesWebPush extends Command
{
    protected $signature = 'webpush:gerar-chaves';

    protected $description = 'Gera um par de chaves VAPID para o Web Push (copie para o .env).';

    public function handle(): int
    {
        $chaves = VAPID::createVapidKeys();

        $this->line("VAPID_PUBLIC_KEY={$chaves['publicKey']}");
        $this->line("VAPID_PRIVATE_KEY={$chaves['privateKey']}");
        $this->warn('Guarde a chave privada em segredo. Trocar as chaves invalida todas as inscrições existentes.');

        return self::SUCCESS;
    }
}
