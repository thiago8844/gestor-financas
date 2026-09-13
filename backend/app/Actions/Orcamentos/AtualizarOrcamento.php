<?php

namespace App\Actions\Orcamentos;

use App\Enums\TipoOrcamento;
use App\Models\Orcamento;
use App\Support\Orcamentos\CalculadoraPeriodoOrcamento;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AtualizarOrcamento
{
    public static function executar(Orcamento $orcamento, array $dados, ?Carbon $referencia = null): Orcamento
    {
        $referencia = $referencia ?? Carbon::today();

        return DB::transaction(function () use ($orcamento, $dados, $referencia) {
            $orcamento->fill([
                'name' => $dados['name'] ?? $orcamento->name,
                'description' => $dados['description'] ?? null,
                'alert_percentage' => $dados['alert_percentage'] ?? null,
                'ignore_pending_installments' => $dados['ignore_pending_installments'] ?? false,
                'active' => $dados['active'] ?? $orcamento->active,
                'frequency' => $dados['frequency'] ?? $orcamento->frequency,
                'interval' => $dados['interval'] ?? $orcamento->interval,
                'start_date' => $dados['start_date'] ?? $orcamento->start_date,
            ]);

            if ($orcamento->type === TipoOrcamento::RECURRING) {
                self::atualizarLimiteRecorrente($orcamento, $dados, $referencia);
            } else {
                $orcamento->amount_limit = $dados['amount_limit'] ?? null;
            }

            $orcamento->save();

            if ($orcamento->type === TipoOrcamento::ONE_TIME && array_key_exists('periodos', $dados)) {
                $orcamento->periodos()->delete();

                foreach ($dados['periodos'] as $periodo) {
                    $orcamento->periodos()->create([
                        'start_date' => $periodo['start_date'],
                        'end_date' => $periodo['end_date'],
                    ]);
                }
            }

            return $orcamento->fresh(['periodos']);
        });
    }

    /**
     * Não sobrescreve o limite atual do orçamento recorrente diretamente: registra uma linha de
     * histórico (aplicando no período atual ou a partir do próximo) pra preservar os períodos passados.
     */
    private static function atualizarLimiteRecorrente(Orcamento $orcamento, array $dados, Carbon $referencia): void
    {
        $limiteEfetivoAtual = $orcamento->limiteEm($referencia);
        $novoLimite = array_key_exists('amount_limit', $dados) ? $dados['amount_limit'] : $limiteEfetivoAtual;
        $novoLimiteFloat = is_null($novoLimite) ? null : (float) $novoLimite;

        if ($novoLimiteFloat === $limiteEfetivoAtual) {
            return;
        }

        $calculadora = new CalculadoraPeriodoOrcamento();
        $periodoAtual = $calculadora->periodoContendo($orcamento, $referencia);

        $aplicarAPartirDe = ($dados['limite_aplicar_a_partir'] ?? 'atual') === 'proximo'
            ? $calculadora->periodoSeguinte($orcamento, $periodoAtual)['inicio']
            : $periodoAtual['inicio'];

        $orcamento->historicoLimite()->create([
            'amount_limit' => $novoLimiteFloat,
            'effective_from' => $aplicarAPartirDe->toDateString(),
        ]);
    }
}
