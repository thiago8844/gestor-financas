<?php

namespace App\Console\Commands;

use App\Actions\GerarTransacoesRecorrentes as GerarTransacoesRecorrentesAction;
use Illuminate\Console\Command;

class GerarTransacoesRecorrentes extends Command
{
    protected $signature = 'recorrencias:gerar';

    protected $description = 'Gera as transações (despesas/receitas) das recorrências que atingiram a data de geração.';

    public function handle(GerarTransacoesRecorrentesAction $action): int
    {
        $gerados = $action->executar();

        $this->info("Transações geradas: {$gerados}");

        return self::SUCCESS;
    }
}
