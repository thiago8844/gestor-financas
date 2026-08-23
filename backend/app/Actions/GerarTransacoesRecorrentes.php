<?php

namespace App\Actions;

use App\Enums\TransactionStatus;
use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class GerarTransacoesRecorrentes
{
    public function executar(?Carbon $hoje = null): int
    {
        $hoje = ($hoje ?? Carbon::today())->startOfDay();
        $gerados = 0;

        RecorrenciaTransacao::where('active', true)
            ->where('next_run_date', '<=', $hoje->toDateString())
            ->each(function (RecorrenciaTransacao $recorrencia) use ($hoje, &$gerados) {
                $gerados += $this->processarRecorrencia($recorrencia->id, $hoje);
            });

        return $gerados;
    }

    private function processarRecorrencia(int $recorrenciaId, Carbon $hoje): int
    {
        $gerados = 0;

        DB::transaction(function () use ($recorrenciaId, $hoje, &$gerados) {
            $recorrencia = RecorrenciaTransacao::whereKey($recorrenciaId)->lockForUpdate()->first();

            if (!$recorrencia || !$recorrencia->active) {
                return;
            }

            while ($recorrencia->next_run_date && $recorrencia->next_run_date->lte($hoje)) {
                $dataOcorrencia = $recorrencia->next_run_date->copy();

                Transacao::create([
                    'user_id' => $recorrencia->user_id,
                    'account_id' => $recorrencia->account_id,
                    'category_id' => $recorrencia->category_id,
                    'type' => $recorrencia->type,
                    'description' => $recorrencia->description,
                    'amount' => $recorrencia->amount,
                    'status' => $recorrencia->default_status,
                    'date' => $recorrencia->default_status === TransactionStatus::PAID ? $dataOcorrencia : null,
                    'due_date' => $recorrencia->default_status === TransactionStatus::PENDING ? $dataOcorrencia : null,
                    'recurring_transaction_id' => $recorrencia->id,
                ]);

                $gerados++;

                $proxima = $recorrencia->proximaOcorrenciaAPartirDe($dataOcorrencia);

                if ($recorrencia->end_date && $proxima->gt($recorrencia->end_date)) {
                    $recorrencia->active = false;
                    $recorrencia->next_run_date = $proxima->toDateString();
                    break;
                }

                $recorrencia->next_run_date = $proxima->toDateString();
            }

            $recorrencia->last_generated_at = now();
            $recorrencia->save();
        });

        return $gerados;
    }
}
