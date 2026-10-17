<?php

namespace App\Queries\Dashboard;

use App\Enums\TimeIntervals;
use App\Support\Relatorios\RolagemFaturaSql;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class SaldoContaPorPeriodoQuery
{
    /**
     * Retorna a evolução do saldo de cada conta (e do total) em pontos contínuos no tempo.
     *
     * Todo bucket do intervalo entre início e fim aparece na série — mesmo sem movimentação —
     * repetindo o saldo anterior (uma conta com R$ 200 mil parada continua em R$ 200 mil).
     * O saldo de abertura (tudo que foi pago antes do início) entra no primeiro ponto, então
     * o último ponto de cada série bate com o saldo atual da conta.
     *
     * Cada ponto: periodo (âncora do bucket), entradas, saidas, saldo_periodo, saldo_acumulado.
     *
     * @param  int[]        $contaIds
     * @param  int[]        $contaIdsPatrimonio  subconjunto de $contaIds que compõe a série "total"
     * @return array{contas: array<int, array>, total: array}
     */
    public static function series(
        array $contaIds,
        array $contaIdsPatrimonio,
        ?Carbon $dataInicial,
        ?Carbon $dataFinal,
        TimeIntervals $intervalo,
        int $userId,
    ): array {
        $vazio = ['contas' => array_fill_keys($contaIds, []), 'total' => []];

        if (empty($contaIds)) {
            return $vazio;
        }

        $query = DB::table('transactions')
            // Crédito da rolagem de fatura (pagamento parcial) abate da saída em vez de virar entrada.
            ->selectRaw(
                'account_id, DATE(date) AS dia, '
                . RolagemFaturaSql::somaEntradas() . ' AS entradas, '
                . RolagemFaturaSql::somaSaidas() . ' AS saidas'
            )
            ->where('user_id', $userId)
            ->where('status', 'PAID')
            ->whereIn('account_id', $contaIds)
            ->whereNotNull('date')
            ->groupBy('account_id')
            ->groupByRaw('DATE(date)');

        if ($dataFinal !== null) {
            $query->where('date', '<=', $dataFinal->toDateString());
        }

        $rows = $query->get();

        if ($rows->isEmpty()) {
            return $vazio;
        }

        $hoje = Carbon::today();
        $primeiroDia = Carbon::parse($rows->min('dia'))->startOfDay();
        $ultimoDia = Carbon::parse($rows->max('dia'))->startOfDay();

        $inicio = $dataInicial?->copy()->startOfDay() ?? $primeiroDia;

        // Não projeta saldo para o futuro além de hoje (ou da última movimentação paga).
        $limite = $hoje->greaterThan($ultimoDia) ? $hoje : $ultimoDia;
        $fim = $dataFinal !== null
            ? ($dataFinal->copy()->startOfDay()->lessThan($limite) ? $dataFinal->copy()->startOfDay() : $limite)
            : $limite;

        if ($fim->lessThan($inicio)) {
            $fim = $inicio->copy();
        }

        // Buckets contínuos do início ao fim.
        $buckets = [];
        $cursor = self::ancora($inicio, $intervalo);
        while ($cursor->lessThanOrEqualTo($fim)) {
            $buckets[] = $cursor->toDateString();
            $cursor = self::avancar($cursor, $intervalo);
        }

        // Agrega por conta: abertura + movimento por bucket.
        $inicioStr = $inicio->toDateString();
        $abertura = array_fill_keys($contaIds, 0.0);
        $movimento = [];

        foreach ($rows as $row) {
            $contaId = (int) $row->account_id;
            $entradas = (float) $row->entradas;
            $saidas = (float) $row->saidas;

            if ($row->dia < $inicioStr) {
                $abertura[$contaId] += $entradas - $saidas;
                continue;
            }

            $chave = self::ancora(Carbon::parse($row->dia), $intervalo)->toDateString();
            $movimento[$contaId][$chave]['entradas'] = ($movimento[$contaId][$chave]['entradas'] ?? 0.0) + $entradas;
            $movimento[$contaId][$chave]['saidas'] = ($movimento[$contaId][$chave]['saidas'] ?? 0.0) + $saidas;
        }

        $series = [];
        foreach ($contaIds as $contaId) {
            $acumulado = $abertura[$contaId];
            $pontos = [];

            foreach ($buckets as $bucket) {
                $entradas = $movimento[$contaId][$bucket]['entradas'] ?? 0.0;
                $saidas = $movimento[$contaId][$bucket]['saidas'] ?? 0.0;
                $acumulado += $entradas - $saidas;

                $pontos[] = self::ponto($bucket, $entradas, $saidas, $acumulado);
            }

            $series[$contaId] = $pontos;
        }

        // Série total (patrimônio): soma ponto a ponto das contas que compõem o patrimônio.
        $total = [];
        foreach ($buckets as $i => $bucket) {
            $entradas = $saidas = $acumulado = 0.0;

            foreach ($contaIdsPatrimonio as $contaId) {
                $p = $series[$contaId][$i] ?? null;
                if ($p === null) {
                    continue;
                }
                $entradas += $p['entradas'];
                $saidas += $p['saidas'];
                $acumulado += $p['saldo_acumulado'];
            }

            $total[] = self::ponto($bucket, $entradas, $saidas, $acumulado);
        }

        return ['contas' => $series, 'total' => $total];
    }

    private static function ponto(string $periodo, float $entradas, float $saidas, float $acumulado): array
    {
        return [
            'periodo'         => $periodo,
            'entradas'        => round($entradas, 2),
            'saidas'          => round($saidas, 2),
            'saldo_periodo'   => round($entradas - $saidas, 2),
            'saldo_acumulado' => round($acumulado, 2),
        ];
    }

    /** Primeiro dia do bucket que contém $data. */
    private static function ancora(Carbon $data, TimeIntervals $intervalo): Carbon
    {
        $d = $data->copy()->startOfDay();

        return match ($intervalo) {
            TimeIntervals::DAILY        => $d,
            TimeIntervals::WEEKLY       => $d->startOfWeek(Carbon::MONDAY),
            TimeIntervals::MONTHLY,
            TimeIntervals::ALL_TIME     => $d->startOfMonth(),
            TimeIntervals::THREE_MONTHS => $d->startOfMonth()->subMonthsNoOverflow(($d->month - 1) % 3),
            TimeIntervals::SIX_MONTHS   => $d->startOfMonth()->subMonthsNoOverflow(($d->month - 1) % 6),
            TimeIntervals::YEARLY       => $d->startOfYear(),
        };
    }

    private static function avancar(Carbon $ancora, TimeIntervals $intervalo): Carbon
    {
        return match ($intervalo) {
            TimeIntervals::DAILY        => $ancora->copy()->addDay(),
            TimeIntervals::WEEKLY       => $ancora->copy()->addWeek(),
            TimeIntervals::MONTHLY,
            TimeIntervals::ALL_TIME     => $ancora->copy()->addMonthNoOverflow(),
            TimeIntervals::THREE_MONTHS => $ancora->copy()->addMonthsNoOverflow(3),
            TimeIntervals::SIX_MONTHS   => $ancora->copy()->addMonthsNoOverflow(6),
            TimeIntervals::YEARLY       => $ancora->copy()->addYear(),
        };
    }
}
