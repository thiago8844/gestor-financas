<?php

namespace App\Actions;

use App\Models\RecorrenciaTransacao;
use Carbon\Carbon;

class AtualizarRecorrenciaTransacao
{
    private const CAMPOS_AGENDA = [
        'frequency',
        'interval',
        'days_of_week',
        'day_of_month',
        'month_of_year',
        'start_date',
    ];

    public static function executar(RecorrenciaTransacao $recorrencia, int $userId, array $dados): RecorrenciaTransacao
    {
        $recorrencia->fill([
            'account_id' => $dados['account_id'],
            'category_id' => CriarRecorrenciaTransacao::resolverCategoria($userId, $dados),
            'type' => $dados['type'],
            'description' => $dados['description'],
            'amount' => $dados['amount'] ?? null,
            'default_status' => $dados['default_status'],
            'frequency' => $dados['frequency'],
            'interval' => $dados['interval'],
            'days_of_week' => $dados['days_of_week'] ?? null,
            'day_of_month' => $dados['day_of_month'] ?? null,
            'month_of_year' => $dados['month_of_year'] ?? null,
            'start_date' => $dados['start_date'],
            'end_date' => $dados['end_date'] ?? null,
            'active' => $dados['active'] ?? $recorrencia->active,
        ]);

        // Só recalcula a próxima geração se algo que afeta a agenda realmente mudou,
        // pra não bagunçar o cronograma de uma recorrência que já gerou transações.
        if ($recorrencia->isDirty(self::CAMPOS_AGENDA)) {
            $inicio = Carbon::parse($recorrencia->start_date)->startOfDay();
            $dataBase = Carbon::today()->greaterThan($inicio) ? Carbon::today() : $inicio;

            $recorrencia->next_run_date = $recorrencia->proximaOcorrenciaAPartirDe($dataBase->copy()->subDay())->toDateString();
            $recorrencia->active = true;
        }

        $recorrencia->save();

        return $recorrencia;
    }
}
