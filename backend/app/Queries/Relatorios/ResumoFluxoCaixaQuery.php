<?php

namespace App\Queries\Relatorios;

use App\Enums\RegimeRelatorio;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ResumoFluxoCaixaQuery
{
    /**
     * Saldo inicial, entradas, saídas e saldo final "reais" da conta(s) no período.
     *
     * Propositalmente calculado só com data/conta/regime — sem os filtros secundários
     * do relatório (categoria, orçamento, valor, descrição etc.), porque "saldo da conta
     * filtrado por categoria" não é um saldo real de verdade. Esses filtros secundários
     * só se aplicam à série (tabela/gráficos) e aos lançamentos, não ao resumo.
     *
     * @return array{saldo_inicial: float, entradas: float, saidas: float, resultado_liquido: float, saldo_final: float}
     */
    public static function query(
        int $userId,
        Carbon $dataInicial,
        Carbon $dataFinal,
        RegimeRelatorio $regime,
        ?int $contaId = null
    ): array {
        // Regime de caixa: só o que já foi efetivamente pago/recebido, na data em que isso ocorreu.
        // Regime de competência: tudo (pago + pendente), na data do compromisso (vencimento quando ainda não pago).
        $colunaData = $regime === RegimeRelatorio::CAIXA ? 'date' : 'COALESCE(date, due_date, created_at)';
        $statuses = $regime === RegimeRelatorio::CAIXA ? ['PAID'] : ['PAID', 'PENDING'];

        $periodo = DB::table('transactions')
            ->where('user_id', $userId)
            ->where('is_initial_balance', false)
            ->whereIn('status', $statuses)
            ->when($contaId, fn ($q) => $q->where('account_id', $contaId))
            ->whereRaw("DATE({$colunaData}) BETWEEN ? AND ?", [$dataInicial->toDateString(), $dataFinal->toDateString()])
            ->selectRaw("
                SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END) AS entradas,
                SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) AS saidas
            ")
            ->first();

        $entradas = (float) ($periodo->entradas ?? 0);
        $saidas = (float) ($periodo->saidas ?? 0);

        // Saldo de abertura: soma de tudo antes do período (incluindo a transação de saldo
        // inicial da conta, que é justamente o que estabelece o ponto de partida).
        $saldoAbertura = DB::table('transactions')
            ->where('user_id', $userId)
            ->whereIn('status', $statuses)
            ->when($contaId, fn ($q) => $q->where('account_id', $contaId))
            ->whereRaw("DATE({$colunaData}) < ?", [$dataInicial->toDateString()])
            ->selectRaw("SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS saldo")
            ->value('saldo');

        $saldoInicial = (float) ($saldoAbertura ?? 0);
        $resultadoLiquido = $entradas - $saidas;
        $saldoFinal = $saldoInicial + $resultadoLiquido;

        return [
            'saldo_inicial' => round($saldoInicial, 2),
            'entradas' => round($entradas, 2),
            'saidas' => round($saidas, 2),
            'resultado_liquido' => round($resultadoLiquido, 2),
            'saldo_final' => round($saldoFinal, 2),
        ];
    }
}
