<?php

namespace App\Support\Simulador;

use App\Actions\Cartoes\CriarDespesaCartao;
use App\Actions\Faturas\ResolverFaturaCompra;
use App\Models\Cartao;
use App\Support\Projecao\GeradorEventosFinanceiros;
use App\Support\Projecao\LinhaDoTempoSaldo;
use Carbon\Carbon;

/**
 * Camada de projeção + cenários: parte dos compromissos conhecidos (GeradorEventosFinanceiros, o
 * mesmo motor do relatório de Compromissos Futuros), soma as estimativas reconciliadas e os eventos
 * hipotéticos, aplica os ajustes do cenário e consolida tudo numa única linha do tempo de caixa
 * (LinhaDoTempoSaldo). TODOS os KPIs, gráficos e tabelas saem de um resultado desta classe — não
 * há regra de cálculo paralela por gráfico.
 *
 * Regras de integridade:
 *  - compras no cartão (reais, estimadas ou hipotéticas) nunca saem do caixa sozinhas: viram itens
 *    da fatura do ciclo correto, que é a única saída de caixa (no vencimento);
 *  - ajustes só alcançam o que é previsão: ocorrências futuras de recorrência, estimativas e eventos
 *    hipotéticos. Lançamentos reais e parcelas contratadas passam intactos;
 *  - nada aqui grava no banco.
 */
final class MotorSimulacao
{
    /** @var array<int, Cartao> */
    private array $cartoes = [];

    /** @var array<string, array{0: string, 1: Carbon, 2: Carbon}> ciclo de fatura por "cartão:data da compra" (memo entre simulações) */
    private array $ciclos = [];

    /** @var string[] todos os dias do horizonte, 'Y-m-d' */
    private array $dias = [];

    private const NATUREZAS_CONHECIDAS = ['CONHECIDO', 'RECORRENCIA'];

    /**
     * @param  array  $base  saída de GerarSimuladorFinanceiro::dadosBase() (coleta + análise histórica)
     */
    public function __construct(
        private readonly FiltrosSimulador $filtros,
        private readonly array $base,
    ) {
        foreach ($base['analise']['cartoes'] as $cartao) {
            $modelo = new Cartao([
                'name' => $cartao['nome'],
                'account_id' => $cartao['conta_id'],
                'closing_day' => $cartao['fechamento'],
                'due_day' => $cartao['vencimento'],
                'active' => $cartao['ativo'],
            ]);
            $modelo->id = $cartao['id'];
            $this->cartoes[$cartao['id']] = $modelo;
        }

        for ($dia = $filtros->hoje->copy(); $dia->lte($filtros->dataFinal); $dia->addDay()) {
            $this->dias[] = $dia->toDateString();
        }
    }

    public function simular(?CenarioSimulacao $cenario = null, string $modo = ProjetorVariaveis::MODO_BASE): array
    {
        $cenario = $cenario !== null && !$cenario->vazio() ? $cenario : null;
        $modelos = $this->modelosPara($cenario);
        $escala = $this->escalaDoCenario($modelos, $modo);
        $projetor = new ProjetorVariaveis($this->filtros, $modelos, $this->base['conta_padrao'], $escala);

        [$eventosCaixa, $faturas] = $this->itensConhecidos();
        [$eventosCaixa, $faturas] = $this->ajustarPrevisoesConhecidas($eventosCaixa, $faturas, $cenario, $modo, $escala);

        $variaveis = $projetor->projetar($cenario, $modo);
        $avisos = [];

        foreach ($variaveis['itens'] as $item) {
            if ($cenario !== null && $item['cartao_id'] !== null) {
                $item = $this->ajustarCompraNoCartao($item, $cenario);
            }
            $this->incluirItem($item, $eventosCaixa, $faturas, $avisos);
        }

        foreach ($cenario?->eventos ?? [] as $evento) {
            foreach ($this->itensHipoteticos($evento, $avisos) as $item) {
                $this->incluirItem($item, $eventosCaixa, $faturas, $avisos);
            }
        }

        $gerador = new GeradorEventosFinanceiros($this->filtros->filtrosProjecao());
        $eventos = [...$eventosCaixa, ...array_map(
            fn (array $evento) => $this->decomporFatura($evento),
            $gerador->eventosDasFaturas($faturas)
        )];

        $linha = LinhaDoTempoSaldo::calcular(
            $this->base['saldos_iniciais'],
            $eventos,
            $this->filtros->hoje,
            $this->filtros->dataFinal,
            $this->base['contas']
        );

        $meses = $this->enriquecerMeses($linha['meses'], $linha['eventos'], $linha['serie_diaria']);

        return [
            'resumo' => $this->resumo($meses, $linha),
            'meses' => $meses,
            'serie_diaria' => $linha['serie_diaria'],
            'eventos' => $linha['eventos'],
            'alertas' => $linha['alertas'],
            'contas' => $linha['contas'],
            'categorias_mes' => $this->categoriasPorMes($linha['eventos']),
            'previsao_categorias' => $variaveis['resumo'],
            'avisos' => array_values(array_unique($avisos)),
        ];
    }

    // -=-=-=- MODELOS -=-=-=-

    /**
     * Modelos da análise + categorias que o usuário pediu para prever manualmente (DEFINIR) e que
     * não têm histórico nenhum: entram com distribuição neutra no mês e na conta padrão.
     */
    private function modelosPara(?CenarioSimulacao $cenario): array
    {
        $modelos = $this->base['analise']['categorias'];

        foreach ($cenario?->ajustes ?? [] as $ajuste) {
            if ($ajuste['alvo'] !== 'CATEGORIA' || $ajuste['modo'] !== 'DEFINIR') {
                continue;
            }

            $tipo = $ajuste['tipo'] ?? 'EXPENSE';
            $chave = $tipo . ':' . ($ajuste['categoria_id'] ?? 0);

            $modelos[$chave] ??= [
                'chave' => $chave,
                'tipo' => $tipo,
                'categoria_id' => $ajuste['categoria_id'],
                'categoria' => $this->base['nomes_categorias'][$ajuste['categoria_id'] ?? 0] ?? 'Sem categoria',
                'historico' => [],
                'estimativa' => ['status' => EstimadorSerieMensal::STATUS_INSUFICIENTE, 'valor' => null, 'desvio' => null, 'confianca' => 'BAIXA', 'modelo' => null],
                'perfil' => PerfilDistribuicaoMensal::aPartirDe([]),
                'canais' => [],
                'conhecido' => [],
                'recorrente' => [],
            ];
        }

        return $modelos;
    }

    /**
     * Otimista/pessimista: em cada mês, o conjunto das estimativas de um tipo se desloca UM desvio
     * típico (as categorias combinadas como independentes: √Σσ²), repartido entre elas pelo
     * desvio de cada uma. Compromissos confirmados não se movem.
     *
     * @return array<string, array<string, float>> fator por [tipo][mes]
     */
    private function escalaDoCenario(array $modelos, string $modo): array
    {
        if ($modo === ProjetorVariaveis::MODO_BASE) {
            return [];
        }

        $projetor = new ProjetorVariaveis($this->filtros, $modelos, $this->base['conta_padrao']);
        $desvios = [];

        foreach ($modelos as $modelo) {
            foreach ($this->filtros->mesesProjetados() as $j => $mes) {
                $desvio = $projetor->desvio($modelo, $j, $mes);
                if ($desvio > 0) {
                    $desvios[$modelo['tipo']][$mes][] = $desvio;
                }
            }
        }

        foreach ($this->itensRecorrenciaEstimados() as $item) {
            if (($item['desvio'] ?? 0) > 0) {
                $desvios[$item['tipo']][substr($item['data'], 0, 7)][] = (float) $item['desvio'];
            }
        }

        $escala = [];
        foreach ($desvios as $tipo => $porMes) {
            foreach ($porMes as $mes => $lista) {
                $soma = array_sum($lista);
                $escala[$tipo][$mes] = $soma > 0 ? sqrt(array_sum(array_map(fn ($d) => $d ** 2, $lista))) / $soma : 0.0;
            }
        }

        return $escala;
    }

    private function itensRecorrenciaEstimados(): array
    {
        $itens = array_filter($this->base['eventos'], fn ($e) => $e['estimado']);

        foreach ($this->base['faturas'] as $fatura) {
            foreach ($fatura['itens'] as $item) {
                if ($item['estimado']) {
                    $itens[] = ['tipo' => 'EXPENSE', 'data' => $item['data_compra'], 'desvio' => $item['desvio']];
                }
            }
        }

        return $itens;
    }

    // -=-=-=- COMPROMISSOS CONHECIDOS E PREVISÕES DE RECORRÊNCIA -=-=-=-

    /** @return array{0: array<int, array>, 1: array<string, array>} */
    private function itensConhecidos(): array
    {
        $eventos = array_map(fn (array $evento) => [
            ...$evento,
            'natureza' => self::natureza($evento),
        ], $this->base['eventos']);

        $faturas = [];
        foreach ($this->base['faturas'] as $chave => $fatura) {
            if ($this->filtros->cartaoIds && !in_array($fatura['cartao_id'], $this->filtros->cartaoIds, true)) {
                continue;
            }

            $fatura['itens'] = array_map(fn (array $item) => [...$item, 'natureza' => self::natureza($item)], $fatura['itens']);
            $faturas[$chave] = $fatura;
        }

        return [$eventos, $faturas];
    }

    private static function natureza(array $item): string
    {
        if ($item['estimado'] ?? false) {
            return 'ESTIMADO';
        }

        return ($item['projetado'] ?? false) ? 'RECORRENCIA' : 'CONHECIDO';
    }

    /**
     * Ajustes do cenário (e deslocamento otimista/pessimista) sobre o que É previsão dentro dos
     * compromissos: ocorrências futuras de recorrências e valores variáveis estimados. Lançamento
     * já cadastrado com valor definido nunca é tocado.
     */
    private function ajustarPrevisoesConhecidas(array $eventos, array $faturas, ?CenarioSimulacao $cenario, string $modo, array $escala): array
    {
        $mesesProjetados = array_flip($this->filtros->mesesProjetados());

        $ajustar = function (array $item, string $tipo, string $data) use ($cenario, $modo, $escala, $mesesProjetados) {
            if ($item['valor'] === null || $item['natureza'] === 'CONHECIDO') {
                return $item;
            }

            $mes = substr($data, 0, 7);
            $valor = (float) $item['valor'];

            if ($item['natureza'] === 'ESTIMADO' && $modo !== ProjetorVariaveis::MODO_BASE) {
                $direcao = ($modo === ProjetorVariaveis::MODO_PESSIMISTA) === ($tipo === 'EXPENSE') ? 1 : -1;
                $valor += $direcao * (float) ($item['desvio'] ?? 0) * ($escala[$tipo][$mes] ?? 0.0);
            }

            if ($cenario !== null) {
                if ($item['natureza'] === 'ESTIMADO' && $tipo === 'EXPENSE' && $cenario->inflacaoMensal != 0.0) {
                    $valor *= (1 + $cenario->inflacaoMensal / 100) ** ($mesesProjetados[$mes] ?? 0);
                }

                foreach ($cenario->ajustes as $ajuste) {
                    if ($ajuste['modo'] === 'PERCENTUAL' && CenarioSimulacao::vigente($ajuste, $mes) && self::alcanca($ajuste, $item, $tipo)) {
                        $valor *= 1 + $ajuste['valor'] / 100;
                    }
                }
            }

            $valor = round(max(0.0, $valor), 2);

            return [...$item, 'valor' => $valor, 'ajustado' => abs($valor - (float) $item['valor']) >= 0.005];
        };

        $eventos = array_map(fn (array $e) => $ajustar($e, $e['tipo'], $e['data_original']), $eventos);

        foreach ($faturas as &$fatura) {
            $fatura['itens'] = array_map(fn (array $i) => $ajustar($i, 'EXPENSE', $i['data_compra'] ?? $fatura['vencimento']->toDateString()), $fatura['itens']);
        }
        unset($fatura);

        return [$eventos, $faturas];
    }

    private static function alcanca(array $ajuste, array $item, string $tipo): bool
    {
        $recorrencia = $item['recorrencia_id'] ?? null;

        return match ($ajuste['alvo']) {
            'RECEITAS_RECORRENTES' => $tipo === 'INCOME' && $recorrencia !== null,
            'DESPESAS_RECORRENTES' => $tipo === 'EXPENSE' && $recorrencia !== null,
            'RECORRENCIA' => $recorrencia !== null && $recorrencia === $ajuste['recorrencia_id'],
            'RECEITAS_ESTIMADAS' => $tipo === 'INCOME' && $item['natureza'] === 'ESTIMADO',
            'DESPESAS_ESTIMADAS' => $tipo === 'EXPENSE' && $item['natureza'] === 'ESTIMADO',
            // "Reduzir Moradia em 20%" vale para o total previsto da categoria — inclusive o aluguel recorrente.
            'CATEGORIA' => $recorrencia !== null && ($ajuste['tipo'] ?? 'EXPENSE') === $tipo
                && (int) ($ajuste['categoria_id'] ?? 0) === (int) ($item['categoria_id'] ?? 0),
            default => false,
        };
    }

    private function ajustarCompraNoCartao(array $item, CenarioSimulacao $cenario): array
    {
        foreach ($cenario->ajustes as $ajuste) {
            if ($ajuste['alvo'] === 'CARTAO' && $ajuste['cartao_id'] === $item['cartao_id']
                && CenarioSimulacao::vigente($ajuste, substr($item['data'], 0, 7))) {
                $item['valor'] = round(max(0.0, $item['valor'] * (1 + $ajuste['valor'] / 100)), 2);
            }
        }

        return $item;
    }

    // -=-=-=- EVENTOS HIPOTÉTICOS -=-=-=-

    /**
     * Expande um evento hipotético em lançamentos: ocorrências (se recorrente) × parcelas.
     * Parcelas no cartão seguem a mesma regra de uma compra real (CriarDespesaCartao): mesmo
     * arredondamento (resto na última) e uma parcela por ciclo de fatura, a partir do ciclo da compra.
     */
    private function itensHipoteticos(array $evento, array &$avisos): array
    {
        $cartao = $evento['cartao_id'] !== null ? ($this->cartoes[$evento['cartao_id']] ?? null) : null;

        if ($evento['cartao_id'] !== null && ($cartao === null || ($this->filtros->cartaoIds && !in_array($cartao->id, $this->filtros->cartaoIds, true)))) {
            $avisos[] = "\"{$evento['descricao']}\" usa um cartão fora dos filtros e foi ignorado.";

            return [];
        }

        $contaId = $cartao?->account_id ?? $evento['conta_id'] ?? $this->base['conta_padrao'];
        if (!array_key_exists($contaId, $this->base['saldos_iniciais'])) {
            $avisos[] = "\"{$evento['descricao']}\" usa uma conta fora dos filtros e foi ignorado.";

            return [];
        }

        $itens = [];
        $parcelas = $evento['frequencia'] ? 1 : $evento['parcelas'];
        $valores = CriarDespesaCartao::dividirValor($evento['valor'], $parcelas);
        $nomeCategoria = $this->base['nomes_categorias'][$evento['categoria_id'] ?? 0] ?? null;

        foreach ($this->ocorrencias($evento) as $o => $data) {
            if ($data->lt($this->filtros->hoje)) {
                $avisos[] = "\"{$evento['descricao']}\" tem data no passado; só as ocorrências a partir de hoje entram.";
                continue;
            }

            $ciclo = $cartao ? ResolverFaturaCompra::referenciaParaCompra($cartao, $data) : null;

            for ($p = 0; $p < $parcelas; $p++) {
                $itens[] = [
                    'id' => "hipotetico:{$evento['id']}:{$o}:{$p}",
                    'evento_id' => $evento['id'],
                    'tipo' => $evento['tipo'],
                    'natureza' => 'HIPOTETICO',
                    'origem' => 'HIPOTETICO',
                    'descricao' => $evento['descricao'],
                    'valor' => $valores[$p],
                    'desvio' => 0.0,
                    'confianca' => null,
                    'categoria_id' => $evento['categoria_id'],
                    'categoria' => $nomeCategoria,
                    'cartao_id' => $cartao?->id,
                    'conta_id' => $contaId,
                    // No cartão, a data é a da COMPRA; o ciclo de cada parcela decide a fatura.
                    'data' => $cartao ? $data->toDateString() : $data->copy()->addMonthsNoOverflow($p)->toDateString(),
                    'ciclo' => $ciclo?->copy()->addMonthsNoOverflow($p),
                    'parcela' => $parcelas > 1 ? ($p + 1) . "/{$parcelas}" : null,
                ];
            }
        }

        return $itens;
    }

    /** @return Carbon[] */
    private function ocorrencias(array $evento): array
    {
        $data = Carbon::parse($evento['data'])->startOfDay();

        if (!$evento['frequencia']) {
            return [$data];
        }

        $fim = $this->filtros->dataFinal->copy();
        if ($evento['data_fim']) {
            $fim = $fim->min(Carbon::parse($evento['data_fim'])->startOfDay());
        }

        $datas = [];
        for ($i = 0; $data->lte($fim) && $i < 1500; $i++) {
            $datas[] = $data->copy();
            $data = match ($evento['frequencia']) {
                'WEEKLY' => $data->copy()->addWeek(),
                'YEARLY' => $data->copy()->addYearNoOverflow(),
                // Mensal: sempre a partir da data original (31/01 → 28/02 → 31/03, sem "escorregar").
                default => Carbon::parse($evento['data'])->startOfDay()->addMonthsNoOverflow($i + 1),
            };
        }

        return $datas;
    }

    // -=-=-=- MONTAGEM DOS EVENTOS -=-=-=-

    /** Compra no cartão → item da fatura do ciclo; o resto → evento de caixa na data. */
    private function incluirItem(array $item, array &$eventos, array &$faturas, array &$avisos): void
    {
        if ($item['valor'] <= 0) {
            return;
        }

        if ($item['cartao_id'] !== null && isset($this->cartoes[$item['cartao_id']])) {
            $this->incluirNaFatura($item, $faturas);

            return;
        }

        $data = Carbon::parse($item['data']);
        if ($data->gt($this->filtros->dataFinal)) {
            return;
        }

        $eventos[] = [
            'id' => $item['id'],
            'data' => $item['data'],
            'data_original' => $item['data'],
            'atrasado' => false,
            'tipo' => $item['tipo'],
            'origem' => $item['origem'],
            'natureza' => $item['natureza'],
            'descricao' => $item['descricao'],
            'valor' => $item['valor'],
            'estimado' => $item['natureza'] === 'ESTIMADO',
            'desvio' => $item['desvio'],
            'confianca' => $item['confianca'],
            'sem_valor' => false,
            'projetado' => true,
            'conta_id' => $item['conta_id'] ?? $this->base['conta_padrao'],
            'categoria' => $item['categoria'],
            'categoria_id' => $item['categoria_id'],
            'transacao_id' => null,
            'parcela' => $item['parcela'] ?? null,
            'recorrencia_id' => null,
            'evento_id' => $item['evento_id'] ?? null,
            'data_estimada' => $item['data_estimada'] ?? null,
            'fatura' => null,
            'itens' => [],
            'itens_sem_valor' => 0,
        ];
    }

    /**
     * Mesma chave do GeradorEventosFinanceiros (cartão + mês do vencimento): uma compra estimada
     * soma na fatura real que já existe para aquele ciclo, em vez de criar outra.
     */
    private function incluirNaFatura(array $item, array &$faturas): void
    {
        $cartao = $this->cartoes[$item['cartao_id']];
        $memo = $item['cartao_id'] . ':' . $item['data'] . ':' . ($item['ciclo'] ?? null)?->format('Y-m');

        if (!isset($this->ciclos[$memo])) {
            $ciclo = $item['ciclo'] ?? ResolverFaturaCompra::referenciaParaCompra($cartao, Carbon::parse($item['data']));
            [$fechamento, $vencimento] = ResolverFaturaCompra::calcularDatas($cartao, $ciclo);
            $this->ciclos[$memo] = [$cartao->id . ':' . $vencimento->format('Y-m'), $fechamento->startOfDay(), $vencimento->startOfDay()];
        }

        [$chave, $fechamento, $vencimento] = $this->ciclos[$memo];

        $faturas[$chave] ??= [
            'fatura_id' => null,
            'cartao_id' => $cartao->id,
            'cartao' => $cartao->name,
            'conta_id' => $cartao->account_id,
            'referencia' => $vencimento->format('Y-m'),
            'fechamento' => $fechamento->copy(),
            'vencimento' => $vencimento->copy(),
            'itens' => [],
        ];

        $faturas[$chave]['itens'][] = [
            'transacao_id' => null,
            'descricao' => $item['descricao'],
            'categoria' => $item['categoria'],
            'categoria_id' => $item['categoria_id'],
            'recorrencia_id' => null,
            'data_compra' => $item['data'],
            'parcela' => $item['parcela'] ?? null,
            'recorrente' => false,
            'projetado' => true,
            'valor' => $item['valor'],
            'estimado' => $item['natureza'] === 'ESTIMADO',
            'desvio' => $item['desvio'],
            'confianca' => $item['confianca'],
            'natureza' => $item['natureza'],
            'evento_id' => $item['evento_id'] ?? null,
            'data_estimada' => $item['data_estimada'] ?? null,
        ];
    }

    /** Quanto da fatura é compromisso conhecido, previsão ou simulação. */
    private function decomporFatura(array $evento): array
    {
        $composicao = ['CONHECIDO' => 0.0, 'RECORRENCIA' => 0.0, 'ESTIMADO' => 0.0, 'HIPOTETICO' => 0.0];

        foreach ($evento['itens'] as $item) {
            $composicao[$item['natureza'] ?? 'CONHECIDO'] += (float) ($item['valor'] ?? 0);
        }

        $evento['natureza'] = 'FATURA';
        $evento['composicao'] = [
            'conhecido' => round($composicao['CONHECIDO'] + $composicao['RECORRENCIA'], 2),
            'estimado' => round($composicao['ESTIMADO'], 2),
            'hipotetico' => round($composicao['HIPOTETICO'], 2),
        ];

        return $evento;
    }

    // -=-=-=- INDICADORES -=-=-=-

    private function enriquecerMeses(array $meses, array $eventos, array $serieDiaria): array
    {
        $vazio = fn () => ['conhecidas' => 0.0, 'estimadas' => 0.0, 'hipoteticas' => 0.0];
        $porMes = [];

        foreach ($eventos as $evento) {
            $mes = substr($evento['data'], 0, 7);
            $porMes[$mes] ??= ['receitas' => $vazio(), 'despesas' => $vazio(), 'faturas' => ['conhecido' => 0.0, 'estimado' => 0.0, 'hipotetico' => 0.0]];
            $valor = (float) ($evento['valor'] ?? 0);

            if ($evento['natureza'] === 'FATURA') {
                foreach ($evento['composicao'] as $parte => $v) {
                    $porMes[$mes]['faturas'][$parte] += $v;
                }
                continue;
            }

            $lado = $evento['tipo'] === 'INCOME' ? 'receitas' : 'despesas';
            $balde = match (true) {
                in_array($evento['natureza'], self::NATUREZAS_CONHECIDAS, true) => 'conhecidas',
                $evento['natureza'] === 'ESTIMADO' => 'estimadas',
                default => 'hipoteticas',
            };
            $porMes[$mes][$lado][$balde] += $valor;
        }

        $diario = $this->estatisticasDiarias($serieDiaria);

        return array_map(function (array $mes) use ($porMes, $diario) {
            $dados = $porMes[$mes['mes']] ?? ['receitas' => [], 'despesas' => [], 'faturas' => []];
            $r = array_map(fn ($v) => round($v, 2), $dados['receitas'] + ['conhecidas' => 0, 'estimadas' => 0, 'hipoteticas' => 0]);
            $d = array_map(fn ($v) => round($v, 2), $dados['despesas'] + ['conhecidas' => 0, 'estimadas' => 0, 'hipoteticas' => 0]);
            $f = array_map(fn ($v) => round($v, 2), $dados['faturas'] + ['conhecido' => 0, 'estimado' => 0, 'hipotetico' => 0]);

            $receitas = round(array_sum($r), 2);
            $faturas = round(array_sum($f), 2);
            $despesas = round(array_sum($d) + $faturas, 2);
            $despesasConfirmadas = round($d['conhecidas'] + $f['conhecido'], 2);

            return [
                ...$mes,
                'receitas' => ['total' => $receitas, ...$r],
                'despesas' => [
                    'total' => $despesas,
                    'conhecidas' => $despesasConfirmadas,
                    'estimadas' => round($d['estimadas'] + $f['estimado'], 2),
                    'hipoteticas' => round($d['hipoteticas'] + $f['hipotetico'], 2),
                    'fora_cartao' => $d,
                ],
                'faturas' => ['total' => $faturas, ...$f],
                'saldo_maximo' => $diario[$mes['mes']]['maximo'] ?? max($mes['saldo_inicial'], $mes['saldo_final']),
                'dias_negativos' => $diario[$mes['mes']]['negativos'] ?? 0,
                'comprometimento_confirmado_pct' => $receitas > 0 ? round($despesasConfirmadas / $receitas * 100, 1) : null,
                'comprometimento_total_pct' => $receitas > 0 ? round($despesas / $receitas * 100, 1) : null,
            ];
        }, $meses);
    }

    /**
     * Saldo ao fim de cada dia (a série só tem os dias com movimento: entre eles o saldo é o mesmo).
     *
     * @return array<string, array{maximo: float, negativos: int}>
     */
    private function estatisticasDiarias(array $serieDiaria): array
    {
        $resultado = [];
        $pontos = array_column($serieDiaria, 'saldo', 'data');
        $saldo = $serieDiaria[0]['saldo'] ?? 0.0;

        foreach ($this->dias as $dia) {
            $saldo = $pontos[$dia] ?? $saldo;
            $mes = substr($dia, 0, 7);

            $resultado[$mes] ??= ['maximo' => $saldo, 'negativos' => 0];
            $resultado[$mes]['maximo'] = max($resultado[$mes]['maximo'], $saldo);
            $resultado[$mes]['negativos'] += $saldo < 0 ? 1 : 0;
        }

        return $resultado;
    }

    private function resumo(array $meses, array $linha): array
    {
        $soma = fn (string $lado, string $campo) => round(array_sum(array_map(fn ($m) => $m[$lado][$campo], $meses)), 2);

        $receitas = $soma('receitas', 'total');
        $despesas = $soma('despesas', 'total');
        $saldoAtual = round(array_sum($this->base['saldos_iniciais']), 2);
        $dias = count($this->dias);
        $despesasConfirmadas = $soma('despesas', 'conhecidas');

        return [
            'saldo_atual' => $saldoAtual,
            'saldo_final' => $linha['saldo_final'],
            'resultado' => round($linha['saldo_final'] - $saldoAtual, 2),
            'receitas' => [
                'total' => $receitas,
                'conhecidas' => $soma('receitas', 'conhecidas'),
                'estimadas' => $soma('receitas', 'estimadas'),
                'hipoteticas' => $soma('receitas', 'hipoteticas'),
            ],
            'despesas' => [
                'total' => $despesas,
                'conhecidas' => $despesasConfirmadas,
                'estimadas' => $soma('despesas', 'estimadas'),
                'hipoteticas' => $soma('despesas', 'hipoteticas'),
            ],
            'faturas' => $soma('faturas', 'total'),
            'comprometimento_confirmado_pct' => $receitas > 0 ? round($despesasConfirmadas / $receitas * 100, 1) : null,
            'comprometimento_total_pct' => $receitas > 0 ? round($despesas / $receitas * 100, 1) : null,
            'taxa_poupanca_pct' => $receitas > 0 ? round(($receitas - $despesas) / $receitas * 100, 1) : null,
            'poupanca_mensal_media' => round(($receitas - $despesas) / max(1.0, $dias / 30.4375), 2),
            'menor_saldo' => $linha['menor_saldo'],
            'dias_negativos' => array_sum(array_column($meses, 'dias_negativos')),
            'sem_valor' => array_sum(array_column($meses, 'sem_valor')),
        ];
    }

    /**
     * Receitas e despesas por categoria e mês, pela data em que saem/entram do caixa (compras no
     * cartão contam no vencimento da fatura) — a soma das categorias bate com as despesas do mês.
     */
    private function categoriasPorMes(array $eventos): array
    {
        $acumulado = [];
        $adicionar = function (string $tipo, ?int $categoriaId, ?string $nome, string $mes, string $natureza, float $valor) use (&$acumulado) {
            $chave = $tipo . ':' . ($categoriaId ?? 0);
            $acumulado[$chave] ??= ['chave' => $chave, 'tipo' => $tipo, 'categoria_id' => $categoriaId, 'categoria' => $nome ?? 'Sem categoria', 'meses' => []];
            $acumulado[$chave]['meses'][$mes] ??= ['mes' => $mes, 'conhecido' => 0.0, 'estimado' => 0.0, 'hipotetico' => 0.0];
            $balde = match ($natureza) {
                'ESTIMADO' => 'estimado',
                'HIPOTETICO' => 'hipotetico',
                default => 'conhecido',
            };
            $acumulado[$chave]['meses'][$mes][$balde] = round($acumulado[$chave]['meses'][$mes][$balde] + $valor, 2);
        };

        foreach ($eventos as $evento) {
            $mes = substr($evento['data'], 0, 7);

            if ($evento['natureza'] === 'FATURA') {
                foreach ($evento['itens'] as $item) {
                    if ($item['valor'] !== null) {
                        $adicionar('EXPENSE', $item['categoria_id'] ?? null, $item['categoria'], $mes, $item['natureza'] ?? 'CONHECIDO', (float) $item['valor']);
                    }
                }
                continue;
            }

            if ($evento['valor'] !== null) {
                $adicionar($evento['tipo'], $evento['categoria_id'] ?? null, $evento['categoria'], $mes, $evento['natureza'], (float) $evento['valor']);
            }
        }

        return array_values(array_map(function (array $categoria) {
            ksort($categoria['meses']);
            $categoria['meses'] = array_values($categoria['meses']);
            $categoria['total'] = round(array_sum(array_map(fn ($m) => $m['conhecido'] + $m['estimado'] + $m['hipotetico'], $categoria['meses'])), 2);

            return $categoria;
        }, $acumulado));
    }
}
