<?php

namespace App\Actions\Relatorios;

use App\Support\Projecao\FiltrosProjecao;
use App\Support\Projecao\GeradorEventosFinanceiros;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Análise dos Gastos: só despesas, olhando para dentro delas.
 *
 * Cada despesa do período (já lançada ou ainda prevista por uma recorrência) entra uma única vez,
 * recebe uma NATUREZA e uma SITUAÇÃO:
 *
 *  Natureza
 *   - FIXA            recorrência de valor fixo (aluguel, assinaturas, mensalidades);
 *   - FIXA_VARIAVEL   recorrência cujo valor muda todo mês (luz, água, internet por consumo);
 *   - VARIAVEL        gasto avulso, sem recorrência (mercado, lazer, restaurante);
 *   - PARCELADA       compra parcelada: já é uma dívida assumida, não um hábito mensal.
 *
 *  Situação
 *   - PAGO        já saiu do bolso;
 *   - PENDENTE    lançado, ainda a pagar;
 *   - PREVISTO    ocorrência futura de recorrência que o sistema ainda não lançou.
 *
 * Base de data: GASTO (dia da compra) ou PAGAMENTO (dia em que a fatura/conta é paga ou vence).
 * Transferências e saldo inicial nunca entram. Lançamentos sem valor definido ficam fora dos
 * totais e são contados em `sem_valor`.
 */
class GerarRelatorioAnaliseGastos
{
    public const NATUREZAS = ['FIXA', 'FIXA_VARIAVEL', 'VARIAVEL', 'PARCELADA'];

    private const MAX_LANCAMENTOS = 3000;
    private const MAX_MESES_GRAFICO = 60;

    public static function executar(int $userId, array $dados, ?Carbon $hoje = null): array
    {
        $hoje = ($hoje ?? Carbon::today())->copy()->startOfDay();
        $inicio = Carbon::parse($dados['data_inicial'])->startOfDay();
        $fim = Carbon::parse($dados['data_final'])->startOfDay();
        $contaIds = array_map('intval', $dados['conta_ids'] ?? []);
        $base = ($dados['base_data'] ?? 'GASTO') === 'PAGAMENTO' ? 'PAGAMENTO' : 'GASTO';
        $origem = $dados['origem'] ?? 'TODAS';
        $estimar = filter_var($dados['estimar_variaveis'] ?? false, FILTER_VALIDATE_BOOLEAN);

        $lancamentos = self::coletar($userId, $inicio, $fim, $contaIds, $base, $origem, $estimar, $hoje);
        $comValor = $lancamentos->filter(fn (array $l) => $l['valor'] !== null);
        $total = round((float) $comValor->sum('valor'), 2);

        // Período anterior de mesma duração (só o que já aconteceu/foi lançado).
        $anterior = null;
        if (filter_var($dados['comparar'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $dias = $inicio->diffInDays($fim) + 1;
            $fimAnt = $inicio->copy()->subDay();
            $inicioAnt = $fimAnt->copy()->subDays($dias - 1);
            $anterior = self::coletar($userId, $inicioAnt, $fimAnt, $contaIds, $base, $origem, $estimar, $hoje)
                ->filter(fn (array $l) => $l['valor'] !== null);
        }

        $meses = max(1.0, ($inicio->diffInDays($fim) + 1) / 30.4375);

        return [
            'periodo' => ['data_inicial' => $inicio->toDateString(), 'data_final' => $fim->toDateString(), 'dias' => $inicio->diffInDays($fim) + 1],
            'filtros' => ['base_data' => $base, 'origem' => $origem, 'estimar_variaveis' => $estimar, 'comparar' => $anterior !== null],
            'resumo' => self::resumo($comValor, $lancamentos, $total, $meses, $anterior, self::receitas($userId, $inicio, $fim, $contaIds), $inicio, $fim),
            'por_natureza' => self::porNatureza($comValor, $anterior, $meses),
            'por_categoria' => self::porCategoria($comValor, $anterior, $total),
            'por_mes' => self::porMes($comValor, $inicio, $fim),
            'por_meio' => self::porMeio($comValor, $total),
            'recorrencias' => self::recorrencias($comValor),
            'parcelamentos' => self::parcelamentos($comValor),
            'maiores' => $comValor->sortByDesc('valor')->take(10)->values()->all(),
            'lancamentos' => $lancamentos->sortByDesc('data')->take(self::MAX_LANCAMENTOS)->values()->all(),
            'lancamentos_truncados' => $lancamentos->count() > self::MAX_LANCAMENTOS,
        ];
    }

    // -=-=-=- COLETA -=-=-=-

    /** @return Collection<int, array> */
    private static function coletar(int $userId, Carbon $inicio, Carbon $fim, array $contaIds, string $base, string $origem, bool $estimar, Carbon $hoje): Collection
    {
        $lancamentos = self::lancados($userId, $inicio, $fim, $contaIds, $base, $origem);

        // Recorrências ainda não lançadas só existem de hoje em diante.
        if ($fim->gte($hoje)) {
            $lancamentos = $lancamentos->concat(self::previstos($userId, $inicio, $fim, $contaIds, $base, $origem, $estimar, $hoje));
        }

        return $lancamentos->values();
    }

    private static function lancados(int $userId, Carbon $inicio, Carbon $fim, array $contaIds, string $base, string $origem): Collection
    {
        $dataRef = $base === 'PAGAMENTO'
            ? "CASE WHEN t.status = 'PAID' THEN COALESCE(t.date, i.due_date, t.due_date, t.created_at)
                    ELSE COALESCE(i.due_date, t.due_date, t.date, t.created_at) END"
            : 'COALESCE(t.purchase_date, t.date, t.due_date, t.created_at)';

        return DB::table('transactions as t')
            ->leftJoin('categories as c', 'c.id', '=', 't.category_id')
            ->leftJoin('accounts as a', 'a.id', '=', 't.account_id')
            ->leftJoin('cards as k', 'k.id', '=', 't.card_id')
            ->leftJoin('invoices as i', 'i.id', '=', 't.invoice_id')
            ->leftJoin('recurring_transactions as r', 'r.id', '=', 't.recurring_transaction_id')
            ->where('t.user_id', $userId)
            ->where('t.type', 'EXPENSE')
            ->where('t.is_initial_balance', false)
            ->whereNull('t.transfer_id')
            ->when($contaIds, fn ($q) => $q->whereIn('t.account_id', $contaIds))
            ->when($origem === 'CARTAO', fn ($q) => $q->whereNotNull('t.card_id'))
            ->when($origem === 'CONTA', fn ($q) => $q->whereNull('t.card_id'))
            ->whereRaw("DATE({$dataRef}) BETWEEN ? AND ?", [$inicio->toDateString(), $fim->toDateString()])
            ->get([
                't.id', 't.amount', 't.status', 't.description', 't.category_id', 'c.name as categoria',
                't.account_id', 'a.name as conta', 't.card_id', 'k.name as cartao',
                't.installment_number', 't.installment_total', 't.installment_group',
                't.recurring_transaction_id', 'r.amount as recorrencia_valor', 'r.description as recorrencia',
                't.purchase_date', 't.date', 't.due_date', 't.created_at', 'i.due_date as fatura_vencimento',
            ])
            ->map(function ($l) use ($base) {
                $pago = $l->status === 'PAID';
                $dataGasto = substr((string) ($l->purchase_date ?? $l->date ?? $l->due_date ?? $l->created_at), 0, 10);
                $dataPagamento = substr((string) ($pago
                    ? ($l->date ?? $l->fatura_vencimento ?? $l->due_date ?? $l->created_at)
                    : ($l->fatura_vencimento ?? $l->due_date ?? $l->date ?? $l->created_at)), 0, 10);

                $parcelada = (int) $l->installment_total > 1;
                $natureza = match (true) {
                    $parcelada => 'PARCELADA',
                    $l->recurring_transaction_id !== null => $l->recorrencia_valor === null ? 'FIXA_VARIAVEL' : 'FIXA',
                    default => 'VARIAVEL',
                };

                return [
                    'id' => (int) $l->id,
                    'data' => $base === 'PAGAMENTO' ? $dataPagamento : $dataGasto,
                    'data_gasto' => $dataGasto,
                    'data_pagamento' => $dataPagamento,
                    'descricao' => $l->description ?: 'Sem descrição',
                    'valor' => $l->amount !== null ? round((float) $l->amount, 2) : null,
                    'natureza' => $natureza,
                    'situacao' => $pago ? 'PAGO' : 'PENDENTE',
                    'estimado' => false,
                    'categoria_id' => $l->category_id !== null ? (int) $l->category_id : null,
                    'categoria' => $l->categoria ?? 'Sem categoria',
                    'conta_id' => (int) $l->account_id,
                    'conta' => $l->conta,
                    'cartao' => $l->cartao,
                    'parcela' => $parcelada ? "{$l->installment_number}/{$l->installment_total}" : null,
                    'grupo_parcelas' => $parcelada ? $l->installment_group : null,
                    'recorrencia_id' => $l->recurring_transaction_id !== null ? (int) $l->recurring_transaction_id : null,
                    'recorrencia' => $l->recorrencia,
                ];
            });
    }

    /** Ocorrências futuras de recorrências que ainda não viraram lançamento (do motor de projeção). */
    private static function previstos(int $userId, Carbon $inicio, Carbon $fim, array $contaIds, string $base, string $origem, bool $estimar, Carbon $hoje): Collection
    {
        $filtros = new FiltrosProjecao(
            userId: $userId,
            hoje: $hoje,
            dataFinal: $fim,
            contaIds: $contaIds,
            estimarVariaveis: $estimar,
            tipos: FiltrosProjecao::DESPESAS,
        );

        $contas = DB::table('accounts')->where('user_id', $userId)->pluck('name', 'id');
        $previstos = collect();

        $adicionar = function (array $dados) use (&$previstos, $inicio, $fim, $origem) {
            if ($dados['data'] < $inicio->toDateString() || $dados['data'] > $fim->toDateString()) {
                return;
            }
            if (($origem === 'CARTAO' && $dados['cartao'] === null) || ($origem === 'CONTA' && $dados['cartao'] !== null)) {
                return;
            }
            $previstos->push($dados);
        };

        foreach ((new GeradorEventosFinanceiros($filtros))->gerar()['eventos'] as $evento) {
            if ($evento['tipo'] !== 'EXPENSE') {
                continue;
            }

            if ($evento['origem'] === 'FATURA') {
                foreach ($evento['itens'] as $item) {
                    if (!$item['projetado'] || !$item['recorrente']) {
                        continue;
                    }
                    $adicionar(self::previsto(
                        $item['descricao'], $item['valor'], $item['estimado'], $item['categoria_id'] ?? null, $item['categoria'],
                        $evento['conta_id'], $contas[$evento['conta_id']] ?? null, $evento['fatura']['cartao'] ?? null,
                        $item['recorrencia_id'] ?? null,
                        $item['data_compra'] ?? $evento['data'],
                        $evento['data'],
                        $base
                    ));
                }
                continue;
            }

            if (!$evento['projetado'] || $evento['recorrencia_id'] === null) {
                continue;
            }

            $adicionar(self::previsto(
                $evento['descricao'], $evento['valor'], $evento['estimado'], $evento['categoria_id'], $evento['categoria'],
                $evento['conta_id'], $contas[$evento['conta_id']] ?? null, null,
                $evento['recorrencia_id'], $evento['data_original'], $evento['data'], $base
            ));
        }

        return $previstos;
    }

    private static function previsto(string $descricao, ?float $valor, bool $estimado, ?int $categoriaId, ?string $categoria, int $contaId, ?string $conta, ?string $cartao, ?int $recorrenciaId, string $dataGasto, string $dataPagamento, string $base): array
    {
        return [
            'id' => null,
            'data' => $base === 'PAGAMENTO' ? $dataPagamento : $dataGasto,
            'data_gasto' => $dataGasto,
            'data_pagamento' => $dataPagamento,
            'descricao' => $descricao,
            'valor' => $valor !== null ? round($valor, 2) : null,
            // Recorrência de valor variável (estimada ou sem valor) é "fixa variável"; o resto é fixa.
            'natureza' => ($valor === null || $estimado) ? 'FIXA_VARIAVEL' : 'FIXA',
            'situacao' => 'PREVISTO',
            'estimado' => $estimado,
            'categoria_id' => $categoriaId,
            'categoria' => $categoria ?? 'Sem categoria',
            'conta_id' => $contaId,
            'conta' => $conta,
            'cartao' => $cartao,
            'parcela' => null,
            'grupo_parcelas' => null,
            'recorrencia_id' => $recorrenciaId,
            'recorrencia' => $descricao,
        ];
    }

    private static function receitas(int $userId, Carbon $inicio, Carbon $fim, array $contaIds): float
    {
        $dataRef = 'COALESCE(date, due_date, created_at)';

        return round((float) DB::table('transactions')
            ->where('user_id', $userId)
            ->where('type', 'INCOME')
            ->where('is_initial_balance', false)
            ->whereNull('transfer_id')
            ->whereNotNull('amount')
            ->when($contaIds, fn ($q) => $q->whereIn('account_id', $contaIds))
            ->whereRaw("DATE({$dataRef}) BETWEEN ? AND ?", [$inicio->toDateString(), $fim->toDateString()])
            ->sum('amount'), 2);
    }

    // -=-=-=- AGREGAÇÕES -=-=-=-

    /** Soma por situação: pago / pendente (lançado) / previsto (ainda não lançado). */
    private static function somas(Collection $itens): array
    {
        $pago = round((float) $itens->where('situacao', 'PAGO')->sum('valor'), 2);
        $pendente = round((float) $itens->where('situacao', 'PENDENTE')->sum('valor'), 2);
        $previsto = round((float) $itens->where('situacao', 'PREVISTO')->sum('valor'), 2);

        return [
            'total' => round($pago + $pendente + $previsto, 2),
            'pago' => $pago,
            'pendente' => $pendente,
            'previsto' => $previsto,
            'quantidade' => $itens->count(),
        ];
    }

    private static function resumo(Collection $comValor, Collection $todos, float $total, float $meses, ?Collection $anterior, float $receitas, Carbon $inicio, Carbon $fim): array
    {
        $somas = self::somas($comValor);
        $fixos = round((float) $comValor->whereIn('natureza', ['FIXA', 'FIXA_VARIAVEL'])->sum('valor'), 2);
        $totalAnterior = $anterior ? round((float) $anterior->sum('valor'), 2) : null;
        $maior = $comValor->sortByDesc('valor')->first();

        return [
            ...$somas,
            'percentual_pago' => $total > 0 ? round($somas['pago'] / $total * 100, 1) : null,
            'sem_valor' => $todos->whereNull('valor')->count(),
            'media_mensal' => round($total / $meses, 2),
            'media_diaria' => round($total / max(1, $inicio->diffInDays($fim) + 1), 2),
            'ticket_medio' => $comValor->count() > 0 ? round($total / $comValor->count(), 2) : null,
            'maior' => $maior ? ['descricao' => $maior['descricao'], 'valor' => $maior['valor'], 'data' => $maior['data'], 'categoria' => $maior['categoria']] : null,
            'fixos' => $fixos,
            'fixos_mensal' => round($fixos / $meses, 2),
            'rigidez_percentual' => $total > 0 ? round($fixos / $total * 100, 1) : null,
            'receitas' => $receitas,
            'comprometimento_receitas' => $receitas > 0 ? round($total / $receitas * 100, 1) : null,
            'no_cartao' => round((float) $comValor->whereNotNull('cartao')->sum('valor'), 2),
            'na_conta' => round((float) $comValor->whereNull('cartao')->sum('valor'), 2),
            'estimado' => round((float) $comValor->where('estimado', true)->sum('valor'), 2),
            'anterior' => $totalAnterior,
            'variacao_percentual' => self::variacao($total, $totalAnterior),
        ];
    }

    private static function porNatureza(Collection $itens, ?Collection $anterior, float $meses): array
    {
        $total = (float) $itens->sum('valor');

        return array_map(function (string $natureza) use ($itens, $anterior, $meses, $total) {
            $grupo = $itens->where('natureza', $natureza);
            $somas = self::somas($grupo);
            $ant = $anterior ? round((float) $anterior->where('natureza', $natureza)->sum('valor'), 2) : null;

            return [
                'natureza' => $natureza,
                ...$somas,
                'percentual' => $total > 0 ? round($somas['total'] / $total * 100, 1) : null,
                'media_mensal' => round($somas['total'] / $meses, 2),
                'no_cartao' => round((float) $grupo->whereNotNull('cartao')->sum('valor'), 2),
                'na_conta' => round((float) $grupo->whereNull('cartao')->sum('valor'), 2),
                'estimado' => round((float) $grupo->where('estimado', true)->sum('valor'), 2),
                'anterior' => $ant,
                'variacao_percentual' => self::variacao($somas['total'], $ant),
            ];
        }, self::NATUREZAS);
    }

    private static function porCategoria(Collection $itens, ?Collection $anterior, float $total): array
    {
        $anteriorPorCategoria = $anterior?->groupBy(fn ($l) => $l['categoria_id'] ?? 0)
            ->map(fn ($g) => round((float) $g->sum('valor'), 2));

        return $itens
            ->groupBy(fn ($l) => $l['categoria_id'] ?? 0)
            ->map(function (Collection $grupo, $chave) use ($total, $anteriorPorCategoria) {
                $somas = self::somas($grupo);
                $ant = $anteriorPorCategoria?->get($chave, 0.0);

                return [
                    'categoria_id' => $chave ?: null,
                    'categoria' => $grupo->first()['categoria'],
                    ...$somas,
                    'percentual' => $total > 0 ? round($somas['total'] / $total * 100, 1) : null,
                    'naturezas' => collect(self::NATUREZAS)->mapWithKeys(
                        fn ($n) => [$n => round((float) $grupo->where('natureza', $n)->sum('valor'), 2)]
                    )->all(),
                    'no_cartao' => round((float) $grupo->whereNotNull('cartao')->sum('valor'), 2),
                    'anterior' => $ant,
                    'variacao_percentual' => $anteriorPorCategoria === null ? null : self::variacao($somas['total'], $ant),
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    private static function porMes(Collection $itens, Carbon $inicio, Carbon $fim): array
    {
        $meses = [];
        for ($m = $inicio->copy()->startOfMonth(), $i = 0; $m->lte($fim) && $i < self::MAX_MESES_GRAFICO; $m->addMonthNoOverflow(), $i++) {
            $meses[$m->format('Y-m')] = [];
        }

        $porMes = $itens->groupBy(fn ($l) => substr($l['data'], 0, 7));

        return collect($meses)->map(function ($_, string $mes) use ($porMes) {
            $grupo = $porMes->get($mes, collect());

            return [
                'mes' => $mes,
                ...self::somas($grupo),
                'naturezas' => collect(self::NATUREZAS)->mapWithKeys(
                    fn ($n) => [$n => round((float) $grupo->where('natureza', $n)->sum('valor'), 2)]
                )->all(),
            ];
        })->values()->all();
    }

    private static function porMeio(Collection $itens, float $total): array
    {
        return $itens
            ->groupBy(fn ($l) => $l['cartao'] !== null ? 'CARTAO:' . $l['cartao'] : 'CONTA:' . ($l['conta'] ?? ''))
            ->map(function (Collection $grupo, string $chave) use ($total) {
                [$tipo, $nome] = explode(':', $chave, 2);
                $somas = self::somas($grupo);

                return [
                    'tipo' => $tipo,
                    'nome' => $nome !== '' ? $nome : 'Conta',
                    ...$somas,
                    'percentual' => $total > 0 ? round($somas['total'] / $total * 100, 1) : null,
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /** Recorrências que pesaram no período: o "custo fixo" detalhado. */
    private static function recorrencias(Collection $itens): array
    {
        return $itens
            ->whereNotNull('recorrencia_id')
            ->groupBy('recorrencia_id')
            ->map(function (Collection $grupo, $id) {
                $primeiro = $grupo->first();
                $valores = $grupo->pluck('valor');

                return [
                    'recorrencia_id' => (int) $id,
                    'descricao' => $primeiro['recorrencia'] ?? $primeiro['descricao'],
                    'natureza' => $grupo->contains('natureza', 'FIXA_VARIAVEL') ? 'FIXA_VARIAVEL' : 'FIXA',
                    'categoria' => $primeiro['categoria'],
                    'meio' => $primeiro['cartao'] ?? $primeiro['conta'],
                    'no_cartao' => $primeiro['cartao'] !== null,
                    ...self::somas($grupo),
                    'ocorrencias' => $grupo->count(),
                    'media' => round((float) $valores->avg(), 2),
                    'minimo' => round((float) $valores->min(), 2),
                    'maximo' => round((float) $valores->max(), 2),
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /** Compras parceladas com parcelas dentro do período. */
    private static function parcelamentos(Collection $itens): array
    {
        return $itens
            ->whereNotNull('grupo_parcelas')
            ->groupBy('grupo_parcelas')
            ->map(function (Collection $grupo) {
                $ordenado = $grupo->sortBy('data');
                $primeiro = $ordenado->first();

                return [
                    'descricao' => $primeiro['descricao'],
                    'categoria' => $primeiro['categoria'],
                    'meio' => $primeiro['cartao'] ?? $primeiro['conta'],
                    'no_cartao' => $primeiro['cartao'] !== null,
                    'parcelas_no_periodo' => $grupo->count(),
                    'primeira' => $primeiro['parcela'],
                    'ultima' => $ordenado->last()['parcela'],
                    ...self::somas($grupo),
                ];
            })
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    private static function variacao(float $atual, ?float $anterior): ?float
    {
        if ($anterior === null || $anterior == 0.0) {
            return null;
        }

        return round((($atual - $anterior) / abs($anterior)) * 100, 1);
    }
}
