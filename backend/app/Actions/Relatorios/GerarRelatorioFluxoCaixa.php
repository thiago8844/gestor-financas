<?php

namespace App\Actions\Relatorios;

use App\Enums\ComparacaoRelatorio;
use App\Enums\TimeIntervals;
use App\Http\Resources\TransacaoResource;
use App\Queries\Relatorios\ResumoFluxoCaixaQuery;
use App\Queries\Relatorios\SerieFluxoCaixaQuery;
use App\Support\Relatorios\FiltrosFluxoCaixa;
use App\Support\Relatorios\PeriodoComparacao;

class GerarRelatorioFluxoCaixa
{
    public static function executar(int $userId, array $dados): array
    {
        $filtros = FiltrosFluxoCaixa::fromArray($userId, $dados);
        $agrupamento = TimeIntervals::from($dados['agrupamento'] ?? TimeIntervals::DAILY->value);
        $compararCom = ComparacaoRelatorio::from($dados['comparar_com'] ?? ComparacaoRelatorio::NENHUM->value);

        $resumo = ResumoFluxoCaixaQuery::query(
            $userId,
            $filtros->dataInicial,
            $filtros->dataFinal,
            $filtros->regime,
            $filtros->contaId
        );

        $resumo['comparacao'] = self::calcularComparacao($userId, $filtros, $compararCom, $resumo['resultado_liquido']);

        $serie = SerieFluxoCaixaQuery::query($filtros, $agrupamento);

        // "Lançamentos" é a mesma massa de dados da série, só achatada e reordenada
        // por data decrescente — evita uma terceira consulta ao banco.
        $lancamentos = collect($serie)
            ->flatMap(fn (array $ponto) => $ponto['transacoes'])
            ->sortByDesc(fn ($transacao) => $transacao->date ?? $transacao->due_date ?? $transacao->created_at)
            ->values();

        return [
            'resumo' => $resumo,
            'serie' => collect($serie)->map(fn (array $ponto) => [
                ...$ponto,
                'transacoes' => TransacaoResource::collection($ponto['transacoes']),
            ])->values(),
            'lancamentos' => TransacaoResource::collection($lancamentos),
        ];
    }

    private static function calcularComparacao(
        int $userId,
        FiltrosFluxoCaixa $filtros,
        ComparacaoRelatorio $modo,
        float $resultadoLiquidoAtual
    ): ?array {
        $periodoAnterior = (new PeriodoComparacao())->calcular($filtros->dataInicial, $filtros->dataFinal, $modo);

        if ($periodoAnterior === null) {
            return null;
        }

        $resumoAnterior = ResumoFluxoCaixaQuery::query(
            $userId,
            $periodoAnterior['inicio'],
            $periodoAnterior['fim'],
            $filtros->regime,
            $filtros->contaId
        );

        $resultadoAnterior = $resumoAnterior['resultado_liquido'];

        $variacaoPercentual = $resultadoAnterior != 0.0
            ? round((($resultadoLiquidoAtual - $resultadoAnterior) / abs($resultadoAnterior)) * 100, 1)
            : null;

        return [
            'periodo_inicio' => $periodoAnterior['inicio']->toDateString(),
            'periodo_fim' => $periodoAnterior['fim']->toDateString(),
            'resultado_liquido' => $resultadoAnterior,
            'variacao_percentual' => $variacaoPercentual,
        ];
    }
}
