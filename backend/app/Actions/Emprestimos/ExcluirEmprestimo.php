<?php

namespace App\Actions\Emprestimos;

use App\Models\Emprestimo;
use Illuminate\Support\Facades\DB;

class ExcluirEmprestimo
{
    /**
     * Exclui o contrato junto com todos os lançamentos que ele gerou (principal e pagamentos).
     */
    public static function executar(Emprestimo $emprestimo): void
    {
        DB::transaction(function () use ($emprestimo) {
            $emprestimo->transacoes()->delete();
            $emprestimo->delete();
        });
    }
}
