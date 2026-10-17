<?php

namespace App\Actions\Dashboard;

use App\Enums\TransactionStatus;
use App\Models\Transacao;
use App\Support\Projecao\FiltrosProjecao;
use App\Support\Projecao\GeradorEventosFinanceiros;
use Carbon\Carbon;

class ObterDespesasFuturasDashboardAction
{
    /**
     * Despesas do início do mês atual até $dataFinal, separadas só em duas coisas:
     *  - pago: o que já saiu (lançamentos pagos e faturas de cartão já pagas);
     *  - a_pagar: o que ainda vai sair (pendentes + ocorrências futuras de recorrências).
     *
     * Cada despesa conta uma única vez e é atribuída a um mês:
     *  - fora do cartão: pela data (pago: data do pagamento; a pagar: vencimento);
     *  - no cartão: pelo vencimento da fatura, nunca pela data da compra. Compras e recorrências
     *    no cartão são abertas dentro da fatura, então não existe o mesmo valor "solto" e "na fatura".
     *
     * `$fonte` limita o que entra: só o já lançado (consolidado: avulsas, parcelas, faturas e recorrências
     * já geradas), só recorrências ainda não lançadas, ou tudo.
     *
     * `recorrentes` é um recorte (já incluído no total) para deixar claro quanto do valor vem de
     * recorrências, tanto no cartão quanto fora dele. Valores variáveis sem valor definido ficam
     * em `sem_valor`, sem estimativa.
     */
    public static function execute(int $userId, Carbon $dataFinal, ?Carbon $hoje = null, string $fonte = FiltrosProjecao::FONTE_TODAS): array
    {
        $hoje = ($hoje ?? Carbon::today())->copy()->startOfDay();
        $inicio = $hoje->copy()->startOfMonth();
        $fim = $dataFinal->copy()->startOfDay();

        $resumo = new class {
            public array $origens = [];
            public array $meses = [];
            public array $faturas = [];
            public int $semValor = 0;
        };

        $somar = function (string $situacao, string $origem, bool $recorrente, float $valor, string $mes) use ($resumo) {
            $resumo->origens[$origem] ??= self::origemVazia();
            $resumo->origens[$origem][$situacao] += $valor;
            if ($recorrente) {
                $resumo->origens[$origem]['recorrentes_' . $situacao] += $valor;
            }

            $resumo->meses[$mes] ??= ['mes' => $mes, 'pago' => 0.0, 'a_pagar' => 0.0];
            $resumo->meses[$mes][$situacao] += $valor;
        };

        // -=-=-=- A PAGAR: motor de projeção (pendentes + recorrências futuras) -=-=-=-

        $filtros = new FiltrosProjecao(
            userId: $userId,
            hoje: $hoje,
            dataFinal: $fim,
            estimarVariaveis: false,
            tipos: FiltrosProjecao::DESPESAS,
            fonte: $fonte,
        );

        foreach ((new GeradorEventosFinanceiros($filtros))->gerar()['eventos'] as $evento) {
            if ($evento['tipo'] !== 'EXPENSE') {
                continue;
            }

            $mes = substr($evento['data'], 0, 7);

            if ($evento['origem'] === 'FATURA') {
                $chave = $evento['fatura']['cartao_id'] . ':' . $evento['fatura']['referencia'];
                $fatura = &self::faturaDoResumo($resumo, $chave, $evento['fatura']['cartao'], $evento['fatura']['vencimento']);
                $fatura['projetada'] = $evento['fatura']['id'] === null;

                foreach ($evento['itens'] as $item) {
                    if ($item['valor'] === null) {
                        $resumo->semValor++;

                        continue;
                    }

                    $somar('a_pagar', 'cartao', $item['recorrente'], $item['valor'], $mes);
                    $fatura['a_pagar'] += $item['valor'];
                    if ($item['recorrente']) {
                        $fatura['recorrentes'] += $item['valor'];
                    }
                }
                unset($fatura);

                continue;
            }

            if ($evento['valor'] === null) {
                $resumo->semValor++;

                continue;
            }

            $somar('a_pagar', 'conta', $evento['origem'] === 'RECORRENTE', $evento['valor'], $mes);
        }

        // -=-=-=- PAGO: lançamentos já pagos dentro do período -=-=-=-

        // Recorrência ainda não lançada nunca está paga: com essa fonte, não há "pago".
        $pagas = $fonte === FiltrosProjecao::FONTE_RECORRENCIAS ? collect() : Transacao::query()
            ->with('fatura.cartao')
            ->where('user_id', $userId)
            ->where('type', 'EXPENSE')
            ->where('status', TransactionStatus::PAID)
            ->where('is_initial_balance', false)
            ->whereNull('transfer_id')
            ->whereNotNull('amount')
            ->where(function ($q) use ($inicio, $fim) {
                $q->where(fn ($q) => $q->whereNull('card_id')
                    ->whereBetween('date', [$inicio->copy()->startOfDay(), $fim->copy()->endOfDay()]))
                    ->orWhere(fn ($q) => $q->whereNotNull('card_id')
                        ->whereHas('fatura', fn ($f) => $f->whereBetween('due_date', [$inicio->toDateString(), $fim->toDateString()])));
            })
            ->get();

        foreach ($pagas as $transacao) {
            $valor = (float) $transacao->amount;
            $recorrente = $transacao->recurring_transaction_id !== null;

            if ($transacao->card_id && $transacao->fatura) {
                $vencimento = $transacao->fatura->due_date;
                $chave = $transacao->card_id . ':' . $transacao->fatura->reference_month->format('Y-m');
                $fatura = &self::faturaDoResumo($resumo, $chave, $transacao->fatura->cartao->name, $vencimento->toDateString());
                $fatura['pago'] += $valor;
                if ($recorrente) {
                    $fatura['recorrentes'] += $valor;
                }
                unset($fatura);

                $somar('pago', 'cartao', $recorrente, $valor, $vencimento->format('Y-m'));

                continue;
            }

            $somar('pago', 'conta', $recorrente, $valor, $transacao->date->format('Y-m'));
        }

        // -=-=-=- SAÍDA -=-=-=-

        $origens = [];
        $pago = 0.0;
        $aPagar = 0.0;
        foreach (['conta', 'cartao'] as $origem) {
            $o = $resumo->origens[$origem] ?? self::origemVazia();
            $origens[$origem] = array_map(fn ($v) => round($v, 2), $o) + ['total' => round($o['pago'] + $o['a_pagar'], 2)];
            $pago += $o['pago'];
            $aPagar += $o['a_pagar'];
        }

        ksort($resumo->meses);
        $faturas = array_values($resumo->faturas);
        usort($faturas, fn ($a, $b) => strcmp($a['vencimento'], $b['vencimento']));

        return [
            'periodo' => [
                'data_inicial' => $inicio->toDateString(),
                'data_final' => $fim->toDateString(),
            ],
            'pago' => round($pago, 2),
            'a_pagar' => round($aPagar, 2),
            'total' => round($pago + $aPagar, 2),
            'sem_valor' => $resumo->semValor,
            'origens' => $origens,
            'faturas' => array_map(fn ($f) => [
                'cartao' => $f['cartao'],
                'vencimento' => $f['vencimento'],
                'projetada' => $f['projetada'],
                'pago' => round($f['pago'], 2),
                'a_pagar' => round($f['a_pagar'], 2),
                'total' => round($f['pago'] + $f['a_pagar'], 2),
                'recorrentes' => round($f['recorrentes'], 2),
            ], $faturas),
            'meses' => array_map(fn ($m) => [
                'mes' => $m['mes'],
                'pago' => round($m['pago'], 2),
                'a_pagar' => round($m['a_pagar'], 2),
                'total' => round($m['pago'] + $m['a_pagar'], 2),
            ], array_values($resumo->meses)),
        ];
    }

    private static function origemVazia(): array
    {
        return ['pago' => 0.0, 'a_pagar' => 0.0, 'recorrentes_pago' => 0.0, 'recorrentes_a_pagar' => 0.0];
    }

    /** Fatura do resumo (criada vazia na primeira vez), devolvida por referência para somar nela. */
    private static function &faturaDoResumo(object $resumo, string $chave, string $cartao, string $vencimento): array
    {
        $resumo->faturas[$chave] ??= [
            'cartao' => $cartao,
            'vencimento' => substr($vencimento, 0, 10),
            'projetada' => false,
            'pago' => 0.0,
            'a_pagar' => 0.0,
            'recorrentes' => 0.0,
        ];

        return $resumo->faturas[$chave];
    }
}
