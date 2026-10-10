<?php

namespace App\Support\Simulador;

/**
 * Riscos identificáveis numa simulação já consolidada. Só alerta com critério explícito — cada
 * alerta diz o que o disparou — e não faz recomendações que os números não sustentem.
 */
final class AnaliseRiscos
{
    /** Comprometimento a partir do qual o mês é sinalizado (despesas ÷ receitas). */
    private const COMPROMETIMENTO_ALTO = 85.0;
    /** Mês "atípico": despesas ao menos 25% acima da mediana dos meses projetados. */
    private const FATOR_MES_ATIPICO = 1.25;
    private const CV_VOLATIL = 0.5;

    public static function analisar(?array $saldoNegativoBase, array $personalizado, array $semReceitasIncertas, array $modelos): array
    {
        return [
            'saldo_negativo' => [
                'base' => $saldoNegativoBase,
                'personalizado' => self::saldoNegativo($personalizado),
                'contas' => array_values(array_filter($personalizado['alertas'], fn ($a) => $a['conta_id'] !== null)),
            ],
            'comprometimento' => self::comprometimento($personalizado['meses']),
            'receitas_incertas' => self::receitasIncertas($personalizado, $semReceitasIncertas),
            'meses_atipicos' => self::mesesAtipicos($personalizado),
            'categorias_volateis' => self::categoriasVolateis($modelos),
        ];
    }

    public static function saldoNegativo(array $simulacao): ?array
    {
        $alerta = collect($simulacao['alertas'])->firstWhere('conta_id', null);

        if ($alerta === null) {
            return null;
        }

        $fim = $alerta['volta_ao_positivo_em'] ?? null;
        $ultimoDia = end($simulacao['serie_diaria'])['data'] ?? $alerta['data'];

        // O que mais pesou até o dia em que o saldo fica negativo.
        $contribuintes = collect($simulacao['eventos'])
            ->filter(fn ($e) => $e['tipo'] === 'EXPENSE' && $e['data'] <= $alerta['data'] && ($e['valor'] ?? 0) > 0)
            ->sortByDesc('valor')
            ->take(5)
            ->map(fn ($e) => [
                'descricao' => $e['descricao'],
                'data' => $e['data'],
                'valor' => $e['valor'],
                'natureza' => $e['natureza'],
            ])
            ->values()
            ->all();

        return [
            'primeira_data' => $alerta['data'],
            'menor_saldo' => $alerta['menor_saldo'],
            'data_menor_saldo' => $alerta['data_menor_saldo'],
            'volta_ao_positivo_em' => $fim,
            'dias' => (int) \Carbon\Carbon::parse($alerta['data'])->diffInDays(\Carbon\Carbon::parse($fim ?? $ultimoDia)) + ($fim ? 0 : 1),
            'contribuintes' => $contribuintes,
        ];
    }

    private static function comprometimento(array $meses): array
    {
        return array_values(array_map(fn ($m) => [
            'mes' => $m['mes'],
            'confirmado_pct' => $m['comprometimento_confirmado_pct'],
            'total_pct' => $m['comprometimento_total_pct'],
            'receitas' => $m['receitas']['total'],
            'despesas' => $m['despesas']['total'],
            'nivel' => match (true) {
                $m['comprometimento_total_pct'] === null => $m['despesas']['total'] > 0 ? 'SEM_RECEITA' : 'OK',
                $m['comprometimento_total_pct'] > 100 => 'EXCEDE',
                $m['comprometimento_total_pct'] >= self::COMPROMETIMENTO_ALTO => 'ALTO',
                default => 'OK',
            },
        ], $meses));
    }

    /**
     * Quanto o resultado depende de receitas que são só estimativa: compara com a mesma simulação
     * sem as receitas estimadas. Alerta quando, sem elas, o caixa ficaria negativo.
     */
    private static function receitasIncertas(array $simulacao, array $semEstimadas): array
    {
        $receitas = $simulacao['resumo']['receitas'];
        $estimadas = $receitas['estimadas'];
        $menorCom = $simulacao['resumo']['menor_saldo']['valor'];
        $menorSem = $semEstimadas['resumo']['menor_saldo']['valor'];

        return [
            'estimadas' => $estimadas,
            'percentual' => $receitas['total'] > 0 ? round($estimadas / $receitas['total'] * 100, 1) : 0.0,
            'menor_saldo_sem_elas' => $menorSem,
            'saldo_final_sem_elas' => $semEstimadas['resumo']['saldo_final'],
            'alerta' => $estimadas > 0 && $menorCom >= 0 && $menorSem < 0,
        ];
    }

    private static function mesesAtipicos(array $simulacao): array
    {
        $meses = $simulacao['meses'];
        $despesas = array_map(fn ($m) => $m['despesas']['total'], $meses);

        if (count($despesas) < 3) {
            return [];
        }

        $ordenadas = $despesas;
        sort($ordenadas);
        $n = count($ordenadas);
        $mediana = $n % 2 ? $ordenadas[intdiv($n, 2)] : ($ordenadas[$n / 2 - 1] + $ordenadas[$n / 2]) / 2;

        if ($mediana <= 0) {
            return [];
        }

        $eventosPorMes = collect($simulacao['eventos'])->groupBy(fn ($e) => substr($e['data'], 0, 7));
        $atipicos = [];

        foreach ($meses as $mes) {
            if ($mes['despesas']['total'] < $mediana * self::FATOR_MES_ATIPICO) {
                continue;
            }

            $atipicos[] = [
                'mes' => $mes['mes'],
                'despesas' => $mes['despesas']['total'],
                'mediana' => round($mediana, 2),
                'excesso' => round($mes['despesas']['total'] - $mediana, 2),
                'principais' => ($eventosPorMes[$mes['mes']] ?? collect())
                    ->where('tipo', 'EXPENSE')
                    ->sortByDesc('valor')
                    ->take(3)
                    ->map(fn ($e) => ['descricao' => $e['descricao'], 'valor' => $e['valor'], 'data' => $e['data']])
                    ->values()
                    ->all(),
            ];
        }

        return $atipicos;
    }

    private static function categoriasVolateis(array $modelos): array
    {
        $projetadas = array_filter($modelos, fn ($m) => $m['tipo'] === 'EXPENSE'
            && $m['estimativa']['status'] === EstimadorSerieMensal::STATUS_PROJETADA);
        $totalEstimado = array_sum(array_map(fn ($m) => $m['estimativa']['valor'], $projetadas));

        return collect($projetadas)
            ->filter(fn ($m) => ($m['estimativa']['estatisticas']['coeficiente_variacao'] ?? 0) >= self::CV_VOLATIL
                && $totalEstimado > 0 && $m['estimativa']['valor'] / $totalEstimado >= 0.03)
            ->sortByDesc(fn ($m) => $m['estimativa']['desvio'])
            ->take(5)
            ->map(fn ($m) => [
                'chave' => $m['chave'],
                'categoria' => $m['categoria'],
                'estimativa' => $m['estimativa']['valor'],
                'desvio' => $m['estimativa']['desvio'],
                'coeficiente_variacao' => $m['estimativa']['estatisticas']['coeficiente_variacao'],
                'maximo' => $m['estimativa']['estatisticas']['maximo'],
            ])
            ->values()
            ->all();
    }
}
