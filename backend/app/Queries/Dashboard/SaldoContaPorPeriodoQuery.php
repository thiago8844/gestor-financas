<?php

namespace App\Queries\Dashboard;

use App\Enums\TimeIntervals;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SaldoContaPorPeriodoQuery
{
    /**
     * Retorna o saldo evolutivo de uma conta (ou de todas as contas do usuário)
     * agrupado pelo intervalo de tempo solicitado — pronto para gráficos.
     *
     * Formato de saída (array de pontos no tempo):
     * [
     *   [
     *     'periodo'         => '2026-01-05',  // data-âncora do grupo (ex: segunda da semana)
     *     'entradas'        => 2000.00,        // soma de receitas no período
     *     'saidas'          => 500.00,         // soma de despesas no período
     *     'saldo_periodo'   => 1500.00,        // saldo líquido do período (entradas − saídas)
     *     'saldo_acumulado' => 1500.00,        // saldo corrido até este período (running total)
     *   ],
     *   ...
     * ]
     *
     * Esse formato é diretamente utilizável por Recharts (prop `data`),
     * ApexCharts, Chart.js (extraindo labels + dataset) e similares.
     *
     * @param  Carbon|null     $dataInicial  Início do intervalo; null = desde a 1ª transação (alltime)
     * @param  Carbon|null     $dataFinal    Fim do intervalo;   null = até a última transação (alltime)
     * @param  TimeIntervals   $intervalo    Granularidade de agrupamento
     * @param  int             $userId       ID do usuário autenticado
     * @param  int|null        $contaId      ID da conta; null = todas as contas do usuário
     */
    public static function query(
        ?Carbon $dataInicial,
        ?Carbon $dataFinal,
        TimeIntervals $intervalo,
        int $userId,
        ?int $contaId = null
    ): array {

        // ------------------------------------------------------------------
        // 1. Expressão SQL de agrupamento conforme o intervalo escolhido.
        //    Cada expressão retorna uma data "âncora" que representa o início
        //    do bucket (dia, semana, mês, trimestre, semestre ou ano).
        // ------------------------------------------------------------------
        $groupExpr = match ($intervalo) {
            // Dia exato da transação
            TimeIntervals::DAILY        => "DATE(date)",

            // Segunda-feira da semana da transação
            // WEEKDAY(date) retorna 0=seg…6=dom, então subtraímos os dias
            // para sempre chegar na segunda-feira do grupo.
            TimeIntervals::WEEKLY       => "DATE(date - INTERVAL WEEKDAY(date) DAY)",

            // Primeiro dia do mês
            TimeIntervals::MONTHLY      => "DATE_FORMAT(date, '%Y-%m-01')",

            // Primeiro dia do trimestre (jan, abr, jul, out)
            // FLOOR((MONTH-1)/3) dá 0,1,2,3 → multiplicado por 3 e +1 = mês inicial
            TimeIntervals::THREE_MONTHS => "DATE_FORMAT(date, CONCAT(YEAR(date), '-', LPAD(FLOOR((MONTH(date)-1)/3)*3+1, 2, '0'), '-01'))",

            // Primeiro dia do semestre (jan ou jul)
            TimeIntervals::SIX_MONTHS   => "DATE_FORMAT(date, CONCAT(YEAR(date), '-', IF(MONTH(date) <= 6, '01', '07'), '-01'))",

            // Primeiro dia do ano
            TimeIntervals::YEARLY       => "DATE_FORMAT(date, '%Y-01-01')",
        };

        // ------------------------------------------------------------------
        // 2. Monta a query agregada.
        //    - Apenas transações PAID (efetivadas) entram no saldo real.
        //    - INCOME soma positivo; EXPENSE soma negativo → saldo_periodo.
        // ------------------------------------------------------------------
        $query = DB::table('transactions')
            ->selectRaw("
                {$groupExpr}                                                     AS periodo,
                SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END)           AS entradas,
                SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END)          AS saidas,
                SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END)     AS saldo_periodo
            ")
            ->where('user_id', $userId)
            ->where('status', 'PAID')                          // somente lançamentos efetivados
            // Aplica filtro de data apenas quando não for alltime (datas não nulas)
            ->when($dataInicial !== null && $dataFinal !== null, fn($q) => $q->whereBetween('date', [
                $dataInicial->toDateString(),
                $dataFinal->toDateString(),
            ]))
            ->groupByRaw($groupExpr)
            ->orderByRaw($groupExpr);                          // ordena cronologicamente

        // Filtra por conta específica quando informado
        if ($contaId !== null) {
            $query->where('account_id', $contaId);
        }

        $rows = $query->get();

        // ------------------------------------------------------------------
        // 3. Calcula o saldo anterior ao período selecionado (saldo de abertura).
        //    Se há filtro de data, soma todas as transações PAID anteriores a
        //    dataInicial para obter o patrimônio real da conta naquele ponto.
        //    Sem filtro (alltime) o saldo de abertura é 0.
        // ------------------------------------------------------------------
        $saldoAbertura = 0.0;

        if ($dataInicial !== null) {
            $aberturaQuery = DB::table('transactions')
                ->where('user_id', $userId)
                ->where('status', 'PAID')
                ->where('date', '<', $dataInicial->toDateString())
                ->selectRaw("SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS saldo");

            if ($contaId !== null) {
                $aberturaQuery->where('account_id', $contaId);
            }

            $saldoAbertura = (float) ($aberturaQuery->value('saldo') ?? 0.0);
        }

        // ------------------------------------------------------------------
        // 4. Calcula o saldo acumulado (running total) em PHP.
        //    Parte do saldo de abertura para que cada ponto represente o
        //    patrimônio real da conta naquele momento.
        // ------------------------------------------------------------------
        $saldoAcumulado = $saldoAbertura;
        $resultado = [];

        foreach ($rows as $row) {
            $saldoAcumulado += (float) $row->saldo_periodo;

            $resultado[] = [
                // Eixo X do gráfico — string de data ISO (ex: "2026-01-05")
                'periodo'         => $row->periodo,

                // Barras ou linhas auxiliares de receita/despesa do período
                'entradas'        => round((float) $row->entradas, 2),
                'saidas'          => round((float) $row->saidas, 2),

                // Saldo líquido apenas daquele período (útil para gráfico de barras)
                'saldo_periodo'   => round((float) $row->saldo_periodo, 2),

                // Saldo acumulado até este ponto (ideal para gráfico de linha/área)
                'saldo_acumulado' => round($saldoAcumulado, 2),
            ];
        }

        return $resultado;
    }
}
