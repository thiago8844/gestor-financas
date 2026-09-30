<?php

namespace App\Console\Commands;

use App\Actions\Faturas\QuitarFaturasAutomaticamente as QuitarFaturasAutomaticamenteAction;
use Illuminate\Console\Command;

class QuitarFaturasAutomaticamente extends Command
{
    protected $signature = 'faturas:quitar-automaticamente';

    protected $description = 'Quita as faturas vencidas dos usuários que ativaram a quitação automática (débito automático).';

    public function handle(QuitarFaturasAutomaticamenteAction $action): int
    {
        $quitadas = $action->executar();

        $this->info("Faturas quitadas: {$quitadas}");

        return self::SUCCESS;
    }
}
