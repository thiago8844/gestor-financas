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
     * Os buckets são agrupados em PHP (não com DATE_FORMAT/WEEKDAY em SQL) para não
     * depender de funções específicas do MySQL — assim o relatório roda igual em
     * qualquer banco (inclui o SQLite usado nos testes).
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

        // 1. Saldo de abertura do conjunto filtrado — serve de base para o saldo acumulado.
        $saldoAbertura = (float) ($filtros->aplicarFiltrosSecundarios(
            DB::table('transactions')
                ->where('user_id', $filtros->userId)
                ->where('is_initial_balance', false)
                ->whereIn('status', $statuses)
                ->whereRaw("DATE({$colunaData}) < ?", [$filtros->dataInicial->toDateString()])
        )->selectRaw("SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS saldo")
            ->value('saldo') ?? 0);

        // 2. Lançamentos individuais do período (para embutir em cada bucket, alimentar a
        //    aba Lançamentos, e calcular os agregados de cada bucket), já com as relações
        //    que o TransacaoResource espera.
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
            ->orderByRaw("DATE({$colunaData}) ASC")
            ->get();

        // Agrupa os lançamentos por bucket, calculando a chave em PHP com a mesma
        // âncora que o resto do app usa (segunda-feira da semana / 1º dia do mês).
        $transacoesPorBucket = $transacoes->groupBy(function (Transacao $transacao) use ($agrupamento) {
            $data = Carbon::parse($transacao->date ?? $transacao->due_date ?? $transacao->created_at);

            return match ($agrupamento) {
                TimeIntervals::WEEKLY => $data->copy()->startOfWeek(Carbon::MONDAY)->toDateString(),
                TimeIntervals::MONTHLY => $data->copy()->startOfMonth()->toDateString(),
                default => $data->toDateString(),
            };
        })->sortKeys();

        // 3. Monta a série final, calculando entradas/saídas/saldo de cada bucket e o
        //    saldo acumulado (running total) a partir dos próprios lançamentos.
        $saldoAcumulado = $saldoAbertura;
        $serie = [];

        foreach ($transacoesPorBucket as $periodo => $itens) {
            $entradas = round((float) $itens->where('type', 'INCOME')->sum('amount'), 2);
            $saidas = round((float) $itens->where('type', 'EXPENSE')->sum('amount'), 2);
            $saldoPeriodo = round($entradas - $saidas, 2);
            $saldoAcumulado = round($saldoAcumulado + $saldoPeriodo, 2);

            $serie[] = [
                'periodo' => $periodo,
                'entradas' => $entradas,
                'saidas' => $saidas,
                'saldo_periodo' => $saldoPeriodo,
                'saldo_acumulado' => $saldoAcumulado,
                'transacoes' => $itens->values(),
            ];
        }

        return $serie;
    }
}
