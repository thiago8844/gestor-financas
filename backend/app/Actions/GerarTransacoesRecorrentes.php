<?php

namespace App\Actions;

use App\Actions\Cartoes\CriarDespesaCartao;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Notificacao;
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

    /**
     * Ocorrência de recorrência no cartão: vira uma compra na data da ocorrência, caindo na fatura
     * certa conforme fechamento/vencimento do cartão (a mesma regra de qualquer compra no cartão).
     */
    private function gerarNoCartao(RecorrenciaTransacao $recorrencia, Carbon $dataOcorrencia): void
    {
        CriarDespesaCartao::executar($recorrencia->user_id, $recorrencia->cartao, [
            'description' => $recorrencia->description,
            'amount' => $recorrencia->amount,
            'accrual_date' => $dataOcorrencia->toDateString(),
            'category_id' => $recorrencia->category_id,
            'recurring_transaction_id' => $recorrencia->id,
        ]);
    }

    private function processarRecorrencia(int $recorrenciaId, Carbon $hoje): int
    {
        $gerados = 0;
        $primeiraData = null;
        $ultimaData = null;

        DB::transaction(function () use ($recorrenciaId, $hoje, &$gerados, &$primeiraData, &$ultimaData) {
            $recorrencia = RecorrenciaTransacao::whereKey($recorrenciaId)->lockForUpdate()->first();

            if (!$recorrencia || !$recorrencia->active) {
                return;
            }

            while ($recorrencia->next_run_date && $recorrencia->next_run_date->lte($hoje)) {
                $dataOcorrencia = $recorrencia->next_run_date->copy();

                if ($recorrencia->card_id) {
                    $this->gerarNoCartao($recorrencia, $dataOcorrencia);
                } else {
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
                }

                $gerados++;
                $primeiraData ??= $dataOcorrencia->copy();
                $ultimaData = $dataOcorrencia->copy();

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

            if ($gerados > 0) {
                $this->notificar($recorrencia, $gerados, $primeiraData, $ultimaData);
            }
        });

        return $gerados;
    }

    /**
     * Deixa rastro: o lançamento aconteceu sem o usuário fazer nada. Uma notificação por recorrência
     * e por execução (ocorrências atrasadas entram juntas, não uma notificação para cada).
     */
    private function notificar(RecorrenciaTransacao $recorrencia, int $gerados, Carbon $primeira, Carbon $ultima): void
    {
        $ehDespesa = $recorrencia->type === TransactionType::EXPENSE;
        $noCartao = (bool) $recorrencia->card_id;
        $pendente = !$noCartao && $recorrencia->default_status === TransactionStatus::PENDING;
        $valor = 'R$ ' . number_format((float) $recorrencia->amount, 2, ',', '.');
        $tipo = $ehDespesa ? 'despesa' : 'receita';

        if ($gerados === 1) {
            $mensagem = "A recorrência \"{$recorrencia->description}\" lançou 1 {$tipo} de {$valor}"
                . ($noCartao ? ' na fatura do cartão' : ($pendente ? ' pendente' : ' já paga/recebida'))
                . " ({$ultima->format('d/m/Y')}).";
        } else {
            $mensagem = "A recorrência \"{$recorrencia->description}\" lançou {$gerados} {$tipo}s de {$valor} cada, "
                . "de {$primeira->format('d/m/Y')} a {$ultima->format('d/m/Y')}.";
        }

        if (!$recorrencia->active) {
            $mensagem .= ' Era a última ocorrência: a recorrência foi encerrada.';
        }

        Notificacao::firstOrCreate(
            ['user_id' => $recorrencia->user_id, 'dedupe_key' => "recorrencia_lancada:{$recorrencia->id}:{$ultima->toDateString()}"],
            [
                'type' => 'recorrencia_lancada',
                'title' => $ehDespesa ? 'Despesa recorrente lançada' : 'Receita recorrente lançada',
                'message' => $mensagem,
                'severity' => 'info',
                'data' => [
                    'recurring_transaction_id' => $recorrencia->id,
                    'quantidade' => $gerados,
                    'amount' => (float) $recorrencia->amount,
                    'encerrada' => !$recorrencia->active,
                ],
                'action_url' => "/recorrencias/editar/{$recorrencia->id}",
            ]
        );
    }
}
