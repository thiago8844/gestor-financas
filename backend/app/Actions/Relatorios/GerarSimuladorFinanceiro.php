<?php

namespace App\Actions\Relatorios;

use App\Models\Categoria;
use App\Models\Conta;
use App\Support\Projecao\GeradorEventosFinanceiros;
use App\Support\Simulador\AnaliseHistorica;
use App\Support\Simulador\AnaliseRiscos;
use App\Support\Simulador\CenarioSimulacao;
use App\Support\Simulador\EstimadorSerieMensal;
use App\Support\Simulador\FiltrosSimulador;
use App\Support\Simulador\MotorSimulacao;
use App\Support\Simulador\ProjetorVariaveis;
use Carbon\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Simulador Financeiro Futuro: projeção completa (compromissos conhecidos + comportamento
 * estimado pelo histórico) e os cenários base, otimista, pessimista e personalizado.
 *
 * Camada de apresentação: tudo que a tela mostra sai de execuções do MotorSimulacao, nunca de
 * contas feitas à parte — o KPI, o gráfico e a tabela de um mesmo cenário batem por construção.
 * A parte cara (histórico, estatística, compromissos) fica em cache e é reaproveitada a cada
 * ajuste de slider; a chave muda sozinha quando qualquer dado financeiro do usuário muda.
 */
class GerarSimuladorFinanceiro
{
    private const CACHE_SEGUNDOS = 600;
    private const MAX_IMPACTOS = 25;
    private const RANK_CONFIANCA = ['BAIXA' => 0, 'MEDIA' => 1, 'ALTA' => 2];

    public static function executar(int $userId, array $dados, ?Carbon $hoje = null): array
    {
        $filtros = FiltrosSimulador::fromArray($userId, $dados, $hoje);
        $cenario = CenarioSimulacao::fromArray($dados['cenario'] ?? null);
        $chave = $filtros->chaveCache(self::versaoDados($filtros->userId));
        $base = self::dadosBase($filtros, $chave);
        $motor = new MotorSimulacao($filtros, $base);

        // O que depende só dos filtros (base, otimista, pessimista, sensibilidade) é calculado uma
        // vez e reaproveitado enquanto o usuário mexe no cenário personalizado.
        $derivados = Cache::remember("{$chave}:derivados", self::CACHE_SEGUNDOS, fn () => self::derivados($motor, $filtros, $base));

        $personalizado = $motor->simular($cenario);

        $semReceitasEstimadas = $personalizado['resumo']['receitas']['estimadas'] > 0
            ? $motor->simular($cenario->com([
                'id' => '__sem_receitas_estimadas', 'alvo' => 'RECEITAS_ESTIMADAS', 'modo' => 'PERCENTUAL',
                'valor' => -100, 'mes_inicio' => null, 'mes_fim' => null, 'tipo' => null,
                'categoria_id' => null, 'cartao_id' => null, 'recorrencia_id' => null, 'rotulo' => null,
            ]))
            : $personalizado;

        return [
            'periodo' => [
                'data_inicial' => $filtros->hoje->toDateString(),
                'data_final' => $filtros->dataFinal->toDateString(),
                'meses' => $filtros->mesesProjetados(),
            ],
            'configuracao' => [
                'estimar_variaveis' => $filtros->estimarVariaveis,
                'prever_despesas_variaveis' => $filtros->preverDespesasVariaveis,
                'prever_receitas_variaveis' => $filtros->preverReceitasVariaveis,
                'meses_historico' => $filtros->mesesHistorico,
                'historico' => [
                    'inicio' => $base['analise']['inicio'],
                    'meses' => count($base['analise']['meses']),
                ],
            ],
            'cenario_ativo' => !$cenario->vazio(),
            'contas' => self::contas($personalizado['contas']),
            'cartoes' => $base['analise']['cartoes'],
            'cenarios' => [
                ...$derivados['cenarios'],
                'personalizado' => self::compacto($personalizado),
            ],
            'eventos' => self::eventosParaTela($personalizado['eventos']),
            'categorias_mes' => $personalizado['categorias_mes'],
            'categorias' => self::categorias($filtros, $base, $derivados['previsao_categorias'], $personalizado),
            'historico' => $base['analise']['mensal'],
            'riscos' => AnaliseRiscos::analisar($derivados['saldo_negativo_base'], $personalizado, $semReceitasEstimadas, $base['analise']['categorias']),
            'sensibilidade' => $derivados['sensibilidade'],
            'impactos' => self::impactos($motor, $cenario, $personalizado),
            'confiabilidade' => $derivados['confiabilidade'],
            'avisos' => $personalizado['avisos'],
        ];
    }

    private static function derivados(MotorSimulacao $motor, FiltrosSimulador $filtros, array $base): array
    {
        $simBase = $motor->simular();

        return [
            'cenarios' => [
                'base' => self::compacto($simBase),
                'otimista' => self::compacto($motor->simular(null, ProjetorVariaveis::MODO_OTIMISTA)),
                'pessimista' => self::compacto($motor->simular(null, ProjetorVariaveis::MODO_PESSIMISTA)),
            ],
            'previsao_categorias' => $simBase['previsao_categorias'],
            'saldo_negativo_base' => AnaliseRiscos::saldoNegativo($simBase),
            'sensibilidade' => self::sensibilidade($motor, $simBase, $base['analise']['categorias'], $base),
            'confiabilidade' => self::confiabilidade($simBase, $base, $filtros),
        ];
    }

    // -=-=-=- DADOS BASE (EM CACHE) -=-=-=-

    public static function dadosBase(FiltrosSimulador $filtros, ?string $chave = null): array
    {
        $chave ??= $filtros->chaveCache(self::versaoDados($filtros->userId));

        return Cache::remember($chave, self::CACHE_SEGUNDOS, function () use ($filtros) {
            $coleta = (new GeradorEventosFinanceiros($filtros->filtrosProjecao()))->coletar();
            $contaIds = array_keys($coleta['saldos_iniciais']);

            $contaPadrao = Conta::where('user_id', $filtros->userId)
                ->whereIn('id', $contaIds ?: [0])
                ->orderByDesc('is_default')
                ->orderBy('id')
                ->value('id');

            return [
                ...$coleta,
                'conta_padrao' => (int) ($contaPadrao ?? 0),
                'nomes_categorias' => Categoria::where('user_id', $filtros->userId)->pluck('name', 'id')->all(),
                'analise' => (new AnaliseHistorica($filtros))->analisar($contaIds, array_sum($coleta['saldos_iniciais']), self::recorrenciasProjetadas($coleta, $filtros)),
            ];
        });
    }

    /**
     * Ocorrências futuras (ainda não geradas) de recorrências, com valor — para a reconciliação das
     * categorias. No cartão, vale a data da compra (é o mês de consumo).
     */
    private static function recorrenciasProjetadas(array $coleta, FiltrosSimulador $filtros): array
    {
        $ocorrencias = [];

        foreach ($coleta['eventos'] as $evento) {
            if ($evento['projetado'] && $evento['recorrencia_id'] !== null && $evento['valor'] !== null) {
                $ocorrencias[] = ['tipo' => $evento['tipo'], 'categoria_id' => $evento['categoria_id'], 'data' => $evento['data_original'], 'valor' => (float) $evento['valor']];
            }
        }

        foreach ($coleta['faturas'] as $fatura) {
            if ($filtros->cartaoIds && !in_array($fatura['cartao_id'], $filtros->cartaoIds, true)) {
                continue;
            }

            foreach ($fatura['itens'] as $item) {
                if ($item['projetado'] && $item['recorrencia_id'] !== null && $item['valor'] !== null) {
                    $ocorrencias[] = ['tipo' => 'EXPENSE', 'categoria_id' => $item['categoria_id'], 'data' => $item['data_compra'], 'valor' => (float) $item['valor']];
                }
            }
        }

        return $ocorrencias;
    }

    /**
     * "Versão" dos dados financeiros do usuário: qualquer lançamento, recorrência, cartão, fatura ou
     * conta criado, alterado ou removido muda o resultado — e invalida o cache sem precisar de eventos.
     */
    private static function versaoDados(int $userId): string
    {
        $partes = [];

        foreach (['transactions', 'recurring_transactions', 'cards', 'invoices', 'accounts', 'categories'] as $tabela) {
            $linha = DB::table($tabela)
                ->where('user_id', $userId)
                ->selectRaw('COUNT(*) AS total, MAX(id) AS ultimo, MAX(updated_at) AS alterado')
                ->first();

            $partes[] = "{$linha->total}.{$linha->ultimo}.{$linha->alterado}";
        }

        $partes[] = (string) DB::table('transactions')->where('user_id', $userId)->sum('amount');

        return md5(implode('|', $partes));
    }

    // -=-=-=- APRESENTAÇÃO -=-=-=-

    private static function compacto(array $simulacao): array
    {
        return [
            'resumo' => $simulacao['resumo'],
            'meses' => $simulacao['meses'],
            'serie_diaria' => $simulacao['serie_diaria'],
        ];
    }

    private static function contas(array $contas): array
    {
        return array_map(fn (array $c) => [
            'id' => $c['conta_id'],
            'nome' => $c['conta'],
            'saldo_atual' => $c['saldo_inicial'],
            'saldo_final' => $c['saldo_final'],
            'menor_saldo' => $c['menor_saldo'],
            'data_menor_saldo' => $c['data_menor_saldo'],
            'fica_negativa' => $c['fica_negativa'],
        ], $contas);
    }

    /**
     * Eventos da linha do tempo só com o que a tela usa (campos nulos/falsos omitidos): com 24
     * meses e muitas categorias são milhares de linhas, e o payload volta a cada ajuste.
     */
    private static function eventosParaTela(array $eventos): array
    {
        // `valor` fica mesmo nulo: "sem valor definido" é informação.
        $enxugar = fn (array $dados) => array_filter($dados, fn ($v, $k) => $k === 'valor' || ($v !== null && $v !== false && $v !== []), ARRAY_FILTER_USE_BOTH);

        return array_values(array_map(fn (array $e) => $enxugar([
            'id' => $e['id'],
            'data' => $e['data'],
            'data_original' => $e['atrasado'] ? $e['data_original'] : null,
            'atrasado' => $e['atrasado'],
            'tipo' => $e['tipo'],
            'origem' => $e['origem'],
            'natureza' => $e['natureza'],
            'descricao' => $e['descricao'],
            'valor' => $e['valor'],
            'confianca' => $e['confianca'],
            'conta_id' => $e['conta_id'],
            'categoria' => $e['categoria'],
            'categoria_id' => $e['categoria_id'] ?? null,
            'parcela' => $e['parcela'],
            'recorrencia_id' => $e['recorrencia_id'],
            'transacao_id' => $e['transacao_id'] ?? null,
            'evento_id' => $e['evento_id'] ?? null,
            'data_estimada' => $e['data_estimada'] ?? null,
            'ajustado' => $e['ajustado'] ?? false,
            'saldo_apos' => $e['saldo_apos'],
            'fatura' => $e['fatura'],
            'composicao' => $e['composicao'] ?? null,
            'itens' => array_map(fn (array $i) => $enxugar([
                'descricao' => $i['descricao'],
                'categoria' => $i['categoria'],
                'data_compra' => $i['data_compra'],
                'parcela' => $i['parcela'],
                'valor' => $i['valor'],
                'natureza' => $i['natureza'] ?? 'CONHECIDO',
                'confianca' => $i['confianca'],
                'transacao_id' => $i['transacao_id'],
                'evento_id' => $i['evento_id'] ?? null,
                'ajustado' => $i['ajustado'] ?? false,
            ]), $e['itens']),
        ]), $eventos));
    }

    /**
     * Uma linha por categoria com tudo que explica a previsão: histórico mês a mês (com os meses
     * atípicos), estatísticas, método escolhido e por quê, validação contra o passado e, mês a mês,
     * previsão × já cadastrado × adicional — no cenário base e no personalizado.
     */
    private static function categorias(FiltrosSimulador $filtros, array $base, array $previsaoBase, array $personalizado): array
    {
        $projetor = new ProjetorVariaveis($filtros, $base['analise']['categorias'], $base['conta_padrao']);
        $nomesCartoes = array_column($base['analise']['cartoes'], 'nome', 'id');
        $linhas = [];

        $chaves = array_unique([
            ...array_keys($base['analise']['categorias']),
            ...array_keys($personalizado['previsao_categorias']),
        ]);

        foreach ($chaves as $chave) {
            $modelo = $base['analise']['categorias'][$chave] ?? null;
            $previstoBase = collect($previsaoBase[$chave] ?? [])->keyBy('mes');
            $previstoCenario = collect($personalizado['previsao_categorias'][$chave] ?? [])->keyBy('mes');
            [$tipo, $categoriaId] = explode(':', $chave);
            $estimativa = $modelo['estimativa'] ?? ['status' => EstimadorSerieMensal::STATUS_INSUFICIENTE];

            $linhas[] = [
                'chave' => $chave,
                'tipo' => $tipo,
                'categoria_id' => (int) $categoriaId ?: null,
                'categoria' => $modelo['categoria'] ?? ($base['nomes_categorias'][(int) $categoriaId] ?? 'Sem categoria'),
                'status' => $estimativa['status'],
                'motivo' => $estimativa['motivo'] ?? null,
                'projetada' => $modelo !== null && $projetor->projetaAutomaticamente($modelo),
                'metodo' => $estimativa['metodo'] ?? null,
                'metodo_rotulo' => $estimativa['metodo_rotulo'] ?? null,
                'estimativa_mensal' => $estimativa['valor'] ?? null,
                'desvio' => $estimativa['desvio'] ?? null,
                'confianca' => $estimativa['confianca'] ?? null,
                'estatisticas' => $estimativa['estatisticas'] ?? null,
                'validacao' => $estimativa['validacao'] ?? null,
                'historico' => $modelo['historico'] ?? [],
                'extraordinarios' => $modelo['extraordinarios'] ?? [],
                'perfil' => $modelo ? ['padrao' => $modelo['perfil']['padrao'], 'pesos' => $modelo['perfil']['pesos']] : null,
                'canais' => array_map(fn (array $c) => [
                    ...$c,
                    'nome' => $c['tipo'] === 'CARTAO' ? ($nomesCartoes[$c['id']] ?? 'Cartão') : ($base['contas'][$c['id']] ?? 'Conta'),
                ], $modelo['canais'] ?? []),
                'projecao' => array_values(array_filter(array_map(function (string $mes) use ($previstoBase, $previstoCenario) {
                    $b = $previstoBase[$mes] ?? null;
                    $c = $previstoCenario[$mes] ?? null;

                    if ($b === null && $c === null) {
                        return null;
                    }

                    return [
                        'mes' => $mes,
                        'automatico' => $b['automatico'] ?? $c['automatico'] ?? 0.0,
                        'conhecido' => $b['conhecido'] ?? $c['conhecido'] ?? 0.0,
                        'adicional_base' => $b['adicional'] ?? 0.0,
                        'previsto_cenario' => $c['previsto'] ?? 0.0,
                        'adicional_cenario' => $c['adicional'] ?? 0.0,
                    ];
                }, $filtros->mesesProjetados()))),
            ];
        }

        return $linhas;
    }

    /**
     * Quanto o saldo final muda com variações plausíveis das principais variáveis — cada uma medida
     * com uma simulação completa (datas, faturas e reconciliação inclusas), não com regra de três.
     * Só entram variáveis que existem nos dados do usuário.
     */
    private static function sensibilidade(MotorSimulacao $motor, array $simBase, array $modelos, array $base): array
    {
        $ajuste = fn (string $id, string $rotulo, array $campos) => [
            'id' => $id, 'rotulo' => $rotulo, 'modo' => 'PERCENTUAL', 'mes_inicio' => null, 'mes_fim' => null,
            'tipo' => null, 'categoria_id' => null, 'cartao_id' => null, 'recorrencia_id' => null, ...$campos,
        ];

        $variacoes = [];

        $principais = collect($modelos)
            ->filter(fn ($m) => $m['tipo'] === 'EXPENSE' && $m['estimativa']['status'] === EstimadorSerieMensal::STATUS_PROJETADA)
            ->sortByDesc(fn ($m) => $m['estimativa']['valor'])
            ->take(5);

        foreach ($principais as $modelo) {
            $variacoes[] = $ajuste("cat:{$modelo['chave']}", "Reduzir {$modelo['categoria']} em 15%", [
                'alvo' => 'CATEGORIA', 'tipo' => 'EXPENSE', 'categoria_id' => $modelo['categoria_id'], 'valor' => -15,
            ]);
        }

        $resumo = $simBase['resumo'];
        if ($resumo['despesas']['estimadas'] > 0) {
            $variacoes[] = $ajuste('desp-est', 'Gastos variáveis 10% maiores', ['alvo' => 'DESPESAS_ESTIMADAS', 'valor' => 10]);
        }
        if ($resumo['receitas']['estimadas'] > 0) {
            $variacoes[] = $ajuste('rec-est', 'Receitas variáveis 20% menores', ['alvo' => 'RECEITAS_ESTIMADAS', 'valor' => -20]);
        }
        if (collect($simBase['eventos'])->contains(fn ($e) => $e['tipo'] === 'INCOME' && $e['natureza'] === 'RECORRENCIA')) {
            $variacoes[] = $ajuste('rec-rec', 'Receitas recorrentes 10% maiores', ['alvo' => 'RECEITAS_RECORRENTES', 'valor' => 10]);
        }

        $cartoesComEstimativa = collect($simBase['eventos'])
            ->where('natureza', 'FATURA')
            ->filter(fn ($e) => $e['composicao']['estimado'] > 0)
            ->pluck('fatura.cartao_id')
            ->unique();
        $nomesCartoes = array_column($base['analise']['cartoes'], 'nome', 'id');

        foreach ($cartoesComEstimativa as $cartaoId) {
            $variacoes[] = $ajuste("cartao:{$cartaoId}", 'Reduzir compras no ' . ($nomesCartoes[$cartaoId] ?? 'cartão') . ' em 20%', [
                'alvo' => 'CARTAO', 'cartao_id' => $cartaoId, 'valor' => -20,
            ]);
        }

        $resultado = [];
        foreach ($variacoes as $variacao) {
            $simulado = $motor->simular(new CenarioSimulacao(ajustes: [$variacao]));
            $impacto = round($simulado['resumo']['saldo_final'] - $resumo['saldo_final'], 2);

            if (abs($impacto) < 0.01) {
                continue;
            }

            $resultado[] = [
                'id' => $variacao['id'],
                'rotulo' => $variacao['rotulo'],
                'ajuste' => $variacao,
                'impacto_saldo_final' => $impacto,
                'impacto_menor_saldo' => round($simulado['resumo']['menor_saldo']['valor'] - $resumo['menor_saldo']['valor'], 2),
            ];
        }

        usort($resultado, fn ($a, $b) => abs($b['impacto_saldo_final']) <=> abs($a['impacto_saldo_final']));

        return $resultado;
    }

    /** Efeito isolado de cada decisão do usuário: o cenário completo × o cenário sem ela. */
    private static function impactos(MotorSimulacao $motor, CenarioSimulacao $cenario, array $personalizado): array
    {
        $impactos = [];

        foreach (array_slice($cenario->decisoes(), 0, self::MAX_IMPACTOS) as $decisao) {
            $sem = $motor->simular($cenario->sem($decisao['id']));
            $mesesSem = collect($sem['meses'])->keyBy('mes');

            $impactos[] = [
                'id' => $decisao['id'],
                'rotulo' => $decisao['rotulo'],
                'impacto_saldo_final' => round($personalizado['resumo']['saldo_final'] - $sem['resumo']['saldo_final'], 2),
                'impacto_menor_saldo' => round($personalizado['resumo']['menor_saldo']['valor'] - $sem['resumo']['menor_saldo']['valor'], 2),
                'impacto_receitas' => round($personalizado['resumo']['receitas']['total'] - $sem['resumo']['receitas']['total'], 2),
                'impacto_despesas' => round($personalizado['resumo']['despesas']['total'] - $sem['resumo']['despesas']['total'], 2),
                'mensal' => array_map(fn (array $m) => [
                    'mes' => $m['mes'],
                    'diferenca' => round($m['saldo_final'] - ($mesesSem[$m['mes']]['saldo_final'] ?? 0), 2),
                ], $personalizado['meses']),
            ];
        }

        return $impactos;
    }

    /**
     * Confiabilidade geral, com critérios explícitos: quanto do período é estimativa e quão
     * confiáveis são essas estimativas (ponderadas pelo valor), além do tamanho do histórico.
     */
    private static function confiabilidade(array $simBase, array $base, FiltrosSimulador $filtros): array
    {
        $resumo = $simBase['resumo'];
        $total = $resumo['receitas']['total'] + $resumo['despesas']['total'];
        $estimado = $resumo['receitas']['estimadas'] + $resumo['despesas']['estimadas'];
        $percentual = $total > 0 ? $estimado / $total : 0.0;

        $pesos = ['valor' => 0.0, 'rank' => 0.0];
        $somar = function (?string $confianca, float $valor) use (&$pesos) {
            $pesos['valor'] += $valor;
            $pesos['rank'] += (self::RANK_CONFIANCA[$confianca ?? 'BAIXA'] ?? 0) * $valor;
        };

        foreach ($simBase['eventos'] as $evento) {
            if ($evento['natureza'] === 'ESTIMADO') {
                $somar($evento['confianca'], (float) $evento['valor']);
            }
            foreach ($evento['itens'] ?? [] as $item) {
                if (($item['natureza'] ?? null) === 'ESTIMADO') {
                    $somar($item['confianca'], (float) $item['valor']);
                }
            }
        }

        $rankMedio = $pesos['valor'] > 0 ? $pesos['rank'] / $pesos['valor'] : 2.0;
        $mesesHistorico = count($base['analise']['meses']);

        $nivel = match (true) {
            $estimado <= 0 => 'ALTA',
            $mesesHistorico < 3 && $percentual > 0.1 => 'BAIXA',
            $percentual < 0.1 => 'ALTA',
            $rankMedio >= 1.5 => 'ALTA',
            $rankMedio >= 0.8 => 'MEDIA',
            default => 'BAIXA',
        };

        $baixas = collect($base['analise']['categorias'])
            ->filter(fn ($m) => ($m['estimativa']['confianca'] ?? null) === 'BAIXA' && $m['estimativa']['status'] === EstimadorSerieMensal::STATUS_PROJETADA)
            ->pluck('categoria')
            ->take(5)
            ->values()
            ->all();

        $motivos = [];
        if ($estimado <= 0) {
            $motivos[] = $filtros->estimarVariaveis
                ? 'A projeção usa só compromissos cadastrados: não houve histórico suficiente para estimar gastos ou receitas variáveis.'
                : 'Estimativas pelo histórico desligadas: a projeção usa só compromissos cadastrados.';
        } else {
            $motivos[] = number_format($percentual * 100, 0, ',', '.') . '% do movimento previsto no período vem de estimativas.';
        }
        $motivos[] = "Histórico analisado: {$mesesHistorico} " . ($mesesHistorico === 1 ? 'mês completo' : 'meses completos') . '.';
        if ($baixas !== []) {
            $motivos[] = 'Categorias com confiança baixa: ' . implode(', ', $baixas) . '.';
        }

        return [
            'nivel' => $nivel,
            'percentual_estimado' => round($percentual * 100, 1),
            'confianca_media' => round($rankMedio, 2),
            'meses_historico' => $mesesHistorico,
            'motivos' => $motivos,
        ];
    }
}
