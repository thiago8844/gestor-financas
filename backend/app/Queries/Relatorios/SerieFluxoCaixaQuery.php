<?php

namespace App\Queries\Relatorios;

use App\Enums\TimeIntervals;
use App\Models\Transacao;
use App\Support\Relatorios\FiltrosFluxoCaixa;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SerieFluxoCaixaQuery
{
    /**
     * Série do fluxo de caixa agrupada por dia/semana/mês, cada ponto já trazendo
     * os lançamentos daquele bucket embutidos (usado pela aba Tabela e pelos Gráficos).
     *
     * Ao contrário de ResumoFluxoCaixaQuery, aqui TODOS os filtros (inclusive os
     * secundários: categoria, orçamento, tipo, valor, descrição) são aplicados —
     * esta é a visão "de detalhe", não o saldo real da conta.
     *
     * @return array<int, array{
     *   periodo: string, entradas: float, saidas: float,
     *   saldo_periodo: float, saldo_acumulado: float, transacoes: \Illuminate\Support\Collection
     * }>
     */
    public static function query(FiltrosFluxoCaixa $filtros, TimeIntervals $agrupamento): array
    {
        $colunaData = $filtros->colunaData();
        $statuses = $filtros->statuses();

        $groupExpr = match ($agrupamento) {
            TimeIntervals::DAILY => "DATE({$colunaData})",
            TimeIntervals::WEEKLY => "DATE(DATE({$colunaData}) - INTERVAL WEEKDAY({$colunaData}) DAY)",
            TimeIntervals::MONTHLY => "DATE_FORMAT({$colunaData}, '%Y-%m-01')",
            default => "DATE({$colunaData})",
        };

        // 1. Agregados por bucket (uma linha por dia/semana/mês).
        $bucketsQuery = $filtros->aplicarFiltrosSecundarios(
            DB::table('transactions')
                ->where('user_id', $filtros->userId)
                ->where('is_initial_balance', false)
                ->whereIn('status', $statuses)
                ->whereRaw("DATE({$colunaData}) BETWEEN ? AND ?", [
                    $filtros->dataInicial->toDateString(),
                    $filtros->dataFinal->toDateString(),
                ])
        )->selectRaw("
                {$groupExpr} AS periodo,
                SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS entradas,
                SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS saidas,
                SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS saldo_periodo
            ")
            ->groupByRaw($groupExpr)
            ->orderByRaw($groupExpr);

        $buckets = $bucketsQuery->get()->keyBy('periodo');

        // 2. Saldo de abertura do conjunto filtrado (mesma lógica do resumo, mas sobre o
        //    recorte filtrado — serve de base para o saldo acumulado desta série).
        $saldoAbertura = (float) ($filtros->aplicarFiltrosSecundarios(
            DB::table('transactions')
                ->where('user_id', $filtros->userId)
                ->where('is_initial_balance', false)
                ->whereIn('status', $statuses)
                ->whereRaw("DATE({$colunaData}) < ?", [$filtros->dataInicial->toDateString()])
        )->selectRaw("SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS saldo")
            ->value('saldo') ?? 0);

        // 3. Lançamentos individuais do período (para embutir em cada bucket e alimentar
        //    a aba Lançamentos), já com as relações que o TransacaoResource espera.
        $transacoes = $filtros->aplicarFiltrosSecundarios(
            Transacao::query()
                ->where('user_id', $filtros->userId)
                ->where('is_initial_balance', false)
                ->whereIn('status', $statuses)
                ->whereRaw("DATE({$colunaData}) BETWEEN ? AND ?", [
                    $filtros->dataInicial->toDateString(),
                    $filtros->dataFinal->toDateString(),
                ])
        )->with(['categoria', 'conta', 'orcamento'])
            ->orderByRaw("DATE({$colunaData}) DESC")
            ->get();

        // Agrupa os lançamentos no mesmo bucket que a query SQL usou, calculando a
        // chave em PHP com a mesma âncora (segunda-feira da semana / 1º dia do mês).
        $transacoesPorBucket = $transacoes->groupBy(function (Transacao $transacao) use ($agrupamento, $filtros) {
            $data = Carbon::parse($transacao->date ?? $transacao->due_date ?? $transacao->created_at);

            return match ($agrupamento) {
                TimeIntervals::WEEKLY => $data->copy()->startOfWeek(Carbon::MONDAY)->toDateString(),
                TimeIntervals::MONTHLY => $data->copy()->startOfMonth()->toDateString(),
                default => $data->toDateString(),
            };
        });

        // 4. Monta a série final, calculando o saldo acumulado (running total) e
        //    embutindo os lançamentos de cada bucket.
        $saldoAcumulado = $saldoAbertura;
        $serie = [];

        foreach ($buckets as $periodo => $linha) {
            $saldoAcumulado += (float) $linha->saldo_periodo;

            $serie[] = [
                'periodo' => $periodo,
                'entradas' => round((float) $linha->entradas, 2),
                'saidas' => round((float) $linha->saidas, 2),
                'saldo_periodo' => round((float) $linha->saldo_periodo, 2),
                'saldo_acumulado' => round($saldoAcumulado, 2),
                'transacoes' => $transacoesPorBucket->get($periodo, collect())->values(),
            ];
        }

        return $serie;
    }
}
