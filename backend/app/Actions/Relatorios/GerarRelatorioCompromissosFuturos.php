<?php

namespace App\Actions\Relatorios;

use App\Support\Projecao\FiltrosProjecao;
use App\Support\Projecao\GeradorEventosFinanceiros;
use App\Support\Projecao\LinhaDoTempoSaldo;
use Carbon\Carbon;

class GerarRelatorioCompromissosFuturos
{
    public static function executar(int $userId, array $dados, ?Carbon $hoje = null): array
    {
        $filtros = FiltrosProjecao::fromArray($userId, $dados, $hoje);

        $base = (new GeradorEventosFinanceiros($filtros))->gerar();

        $linhaDoTempo = LinhaDoTempoSaldo::calcular(
            $base['saldos_iniciais'],
            $base['eventos'],
            $filtros->hoje,
            $filtros->dataFinal,
            $base['contas']
        );

        $eventos = collect($linhaDoTempo['eventos'])->map(fn (array $evento) => [
            ...$evento,
            'conta' => $base['contas'][$evento['conta_id']] ?? null,
        ]);

        return [
            'periodo' => [
                'data_inicial' => $filtros->hoje->toDateString(),
                'data_final' => $filtros->dataFinal->toDateString(),
            ],
            'estimar_variaveis' => $filtros->estimarVariaveis,
            'resumo' => self::montarResumo($eventos, $linhaDoTempo, array_sum($base['saldos_iniciais'])),
            'meses' => $linhaDoTempo['meses'],
            'serie_diaria' => $linhaDoTempo['serie_diaria'],
            'contas' => $linhaDoTempo['contas'],
            'alertas' => $linhaDoTempo['alertas'],
            'eventos' => $eventos->values()->all(),
        ];
    }

    private static function montarResumo($eventos, array $linhaDoTempo, float $saldoAtual): array
    {
        $entradas = $eventos->where('tipo', 'INCOME');
        $saidas = $eventos->where('tipo', 'EXPENSE');

        $aReceber = round((float) $entradas->sum('valor'), 2);
        $aPagar = round((float) $saidas->sum('valor'), 2);
        $saldoAtual = round($saldoAtual, 2);

        // Quanto do dinheiro "à vista" (saldo + o que ainda vai entrar) já tem destino.
        $disponivel = max($saldoAtual, 0) + $aReceber;
        $atrasados = $eventos->where('atrasado', true);

        return [
            'saldo_atual' => $saldoAtual,
            'a_receber' => $aReceber,
            'a_pagar' => $aPagar,
            'resultado' => round($aReceber - $aPagar, 2),
            'saldo_final' => $linhaDoTempo['saldo_final'],
            'menor_saldo' => $linhaDoTempo['menor_saldo'],
            'comprometido_percentual' => $disponivel > 0 ? round($aPagar / $disponivel * 100, 1) : null,
            'estimado' => [
                'a_receber' => round((float) $entradas->where('estimado', true)->sum('valor'), 2),
                'a_pagar' => round((float) $saidas->where('estimado', true)->sum('valor'), 2),
            ],
            'sem_valor' => (int) $eventos->sum('itens_sem_valor'),
            'atrasados' => [
                'quantidade' => $atrasados->count(),
                'a_pagar' => round((float) $atrasados->where('tipo', 'EXPENSE')->sum('valor'), 2),
                'a_receber' => round((float) $atrasados->where('tipo', 'INCOME')->sum('valor'), 2),
            ],
            'quantidade' => $eventos->count(),
            'composicao_saidas' => $saidas
                ->groupBy('origem')
                ->map(fn ($grupo, $origem) => [
                    'origem' => $origem,
                    'total' => round((float) $grupo->sum('valor'), 2),
                    'quantidade' => $grupo->count(),
                ])
                ->sortByDesc('total')
                ->values()
                ->all(),
        ];
    }
}
