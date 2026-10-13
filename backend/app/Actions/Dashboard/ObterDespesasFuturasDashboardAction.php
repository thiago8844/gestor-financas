<?php

namespace App\Actions\Dashboard;

use App\Support\Projecao\FiltrosProjecao;
use App\Support\Projecao\GeradorEventosFinanceiros;
use Carbon\Carbon;

class ObterDespesasFuturasDashboardAction
{
    private const CATEGORIAS = ['parcelas', 'recorrencias', 'outras'];

    /**
     * Quanto ainda vai sair de hoje até $dataFinal, separado em:
     *  - parcelas: compras parceladas (no cartão ou não);
     *  - recorrencias: despesas fixas/recorrentes (inclusive as lançadas no cartão);
     *  - outras: lançamentos pendentes avulsos e compras à vista no cartão.
     *
     * Usa o mesmo motor do relatório de Compromissos Futuros, sem estimar valores variáveis:
     * só entra o que já tem valor garantido (o que não tem valor aparece em `sem_valor`).
     * Compras de cartão são abertas por item, então nada é contado duas vezes.
     */
    public static function execute(int $userId, Carbon $dataFinal, ?Carbon $hoje = null): array
    {
        $filtros = new FiltrosProjecao(
            userId: $userId,
            hoje: ($hoje ?? Carbon::today())->copy()->startOfDay(),
            dataFinal: $dataFinal->copy()->startOfDay(),
            estimarVariaveis: false,
            tipos: FiltrosProjecao::DESPESAS,
        );

        $eventos = (new GeradorEventosFinanceiros($filtros))->gerar()['eventos'];

        $totais = array_fill_keys(self::CATEGORIAS, ['total' => 0.0, 'quantidade' => 0]);
        $meses = [];
        $faturas = [];
        $semValor = 0;

        $somar = function (string $categoria, ?float $valor, string $data) use (&$totais, &$meses, &$semValor) {
            if ($valor === null) {
                $semValor++;

                return;
            }

            $mes = substr($data, 0, 7);
            $meses[$mes] ??= ['mes' => $mes, ...array_fill_keys(self::CATEGORIAS, 0.0), 'total' => 0.0];

            $totais[$categoria]['total'] += $valor;
            $totais[$categoria]['quantidade']++;
            $meses[$mes][$categoria] += $valor;
            $meses[$mes]['total'] += $valor;
        };

        foreach ($eventos as $evento) {
            if ($evento['tipo'] !== 'EXPENSE') {
                continue;
            }

            if ($evento['origem'] === 'FATURA') {
                $faturas[] = [
                    'cartao' => $evento['fatura']['cartao'],
                    'vencimento' => $evento['fatura']['vencimento'],
                    'total' => $evento['valor'] ?? 0.0,
                ];

                foreach ($evento['itens'] as $item) {
                    $categoria = $item['parcela'] !== null ? 'parcelas' : ($item['recorrente'] ? 'recorrencias' : 'outras');
                    $somar($categoria, $item['valor'], $evento['data']);
                }

                continue;
            }

            $categoria = match ($evento['origem']) {
                'PARCELA' => 'parcelas',
                'RECORRENTE' => 'recorrencias',
                default => 'outras',
            };
            $somar($categoria, $evento['valor'], $evento['data']);
        }

        ksort($meses);
        usort($faturas, fn ($a, $b) => strcmp($a['vencimento'], $b['vencimento']));

        $arredondar = fn (array $t) => ['total' => round($t['total'], 2), 'quantidade' => $t['quantidade']];

        return [
            'periodo' => [
                'data_inicial' => $filtros->hoje->toDateString(),
                'data_final' => $filtros->dataFinal->toDateString(),
            ],
            'total' => round(array_sum(array_column($totais, 'total')), 2),
            'quantidade' => array_sum(array_column($totais, 'quantidade')),
            'parcelas' => $arredondar($totais['parcelas']),
            'recorrencias' => $arredondar($totais['recorrencias']),
            'outras' => $arredondar($totais['outras']),
            'sem_valor' => $semValor,
            'faturas' => array_map(fn ($f) => [...$f, 'total' => round($f['total'], 2)], $faturas),
            'meses' => array_map(
                fn ($m) => [
                    'mes' => $m['mes'],
                    'parcelas' => round($m['parcelas'], 2),
                    'recorrencias' => round($m['recorrencias'], 2),
                    'outras' => round($m['outras'], 2),
                    'total' => round($m['total'], 2),
                ],
                array_values($meses)
            ),
        ];
    }
}
