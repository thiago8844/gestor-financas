<?php

namespace App\Actions\Relatorios;

use App\Enums\ComparacaoRelatorio;
use App\Http\Resources\TransacaoResource;
use App\Queries\Relatorios\CategoriasResultadoFinanceiroQuery;
use App\Queries\Relatorios\ResumoResultadoFinanceiroQuery;
use App\Queries\Relatorios\SerieMensalResultadoFinanceiroQuery;
use App\Support\Relatorios\FiltrosResultadoFinanceiro;
use App\Support\Relatorios\PeriodoComparacao;
use Illuminate\Support\Collection;

class GerarRelatorioResultadoFinanceiro
{
    public static function executar(int $userId, array $dados): array
    {
        $filtros = FiltrosResultadoFinanceiro::fromArray($userId, $dados);
        $compararCom = ComparacaoRelatorio::from($dados['comparar_com'] ?? ComparacaoRelatorio::NENHUM->value);

        $resumo = ResumoResultadoFinanceiroQuery::query($filtros);
        $receitasPorCategoria = CategoriasResultadoFinanceiroQuery::query($filtros, 'INCOME');
        $despesasPorCategoria = CategoriasResultadoFinanceiroQuery::query($filtros, 'EXPENSE');

        $periodoAnterior = (new PeriodoComparacao())->calcular($filtros->dataInicial, $filtros->dataFinal, $compararCom);

        $resumoAnterior = null;
        $receitasAnteriorPorCategoria = null;
        $despesasAnteriorPorCategoria = null;

        if ($periodoAnterior !== null) {
            $filtrosAnterior = new FiltrosResultadoFinanceiro(
                userId: $userId,
                dataInicial: $periodoAnterior['inicio'],
                dataFinal: $periodoAnterior['fim'],
                regime: $filtros->regime,
                contaId: $filtros->contaId,
            );

            $resumoAnterior = ResumoResultadoFinanceiroQuery::query($filtrosAnterior);
            $receitasAnteriorPorCategoria = CategoriasResultadoFinanceiroQuery::query($filtrosAnterior, 'INCOME');
            $despesasAnteriorPorCategoria = CategoriasResultadoFinanceiroQuery::query($filtrosAnterior, 'EXPENSE');
        }

        return [
            'resumo' => [
                ...$resumo,
                'comparacao' => $resumoAnterior === null ? null : [
                    'periodo_inicio' => $periodoAnterior['inicio']->toDateString(),
                    'periodo_fim' => $periodoAnterior['fim']->toDateString(),
                    'resultado' => $resumoAnterior['resultado'],
                    'variacao_percentual' => self::variacaoPercentual($resumo['resultado'], $resumoAnterior['resultado']),
                ],
            ],
            'receitas' => self::montarLinhas($receitasPorCategoria, $resumo['receitas'], $receitasAnteriorPorCategoria),
            'despesas' => self::montarLinhas($despesasPorCategoria, $resumo['despesas'], $despesasAnteriorPorCategoria),
            'serie_mensal' => SerieMensalResultadoFinanceiroQuery::query($filtros),
        ];
    }

    /**
     * @param  Collection  $linhas          categoria => {categoria_id, categoria, total, transacoes}
     * @param  Collection|null  $linhasAnterior  mesma forma, do período de comparação
     */
    private static function montarLinhas(Collection $linhas, float $totalTipo, ?Collection $linhasAnterior): array
    {
        return $linhas->map(function (array $linha) use ($totalTipo, $linhasAnterior) {
            $anterior = $linhasAnterior?->firstWhere('categoria_id', $linha['categoria_id']);

            return [
                'categoria_id' => $linha['categoria_id'],
                'categoria' => $linha['categoria'],
                'total' => $linha['total'],
                'percentual' => $totalTipo > 0 ? round(($linha['total'] / $totalTipo) * 100, 1) : null,
                'periodo_anterior' => $anterior['total'] ?? null,
                'variacao_percentual' => $anterior ? self::variacaoPercentual($linha['total'], $anterior['total']) : null,
                'transacoes' => TransacaoResource::collection($linha['transacoes']),
            ];
        })->values()->all();
    }

    private static function variacaoPercentual(float $atual, float $anterior): ?float
    {
        if ($anterior == 0.0) {
            return null;
        }

        return round((($atual - $anterior) / abs($anterior)) * 100, 1);
    }
}
