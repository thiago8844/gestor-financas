<?php

namespace App\Support\Simulador;

/**
 * Transforma os modelos de categoria em lançamentos ESTIMADOS datados, já reconciliados com o que
 * está cadastrado — o coração do "não duplicar previsões":
 *
 *   total previsto da categoria no mês (consumo)  −  o que já está previsto no mês  =  adicional
 *
 * ("já previsto": lançado, agendado e ocorrências futuras de recorrências da categoria)
 *
 * No mês corrente o adicional também é limitado ao que o perfil da categoria diz que ainda "falta
 * acontecer" (gastar R$ 100 de mercado até o dia 28 não significa R$ 600 nos próximos 3 dias).
 *
 * O adicional é distribuído nas faixas do mês em que a categoria costuma acontecer e entre os meios
 * de pagamento habituais. Se o meio for cartão, o lançamento é uma COMPRA (data da compra); quem
 * decide a fatura em que ela cai é o Consolidador, com a regra de fechamento do cartão.
 */
final class ProjetorVariaveis
{
    public const MODO_BASE = 'BASE';
    public const MODO_OTIMISTA = 'OTIMISTA';
    public const MODO_PESSIMISTA = 'PESSIMISTA';

    /**
     * @param  array<string, array>  $modelos  saída de AnaliseHistorica['categorias']
     * @param  array<string, array<string, float>>  $escala  [tipo][mes] fator do cenário otimista/pessimista
     */
    public function __construct(
        private readonly FiltrosSimulador $filtros,
        private readonly array $modelos,
        private readonly int $contaPadrao,
        private readonly array $escala = [],
    ) {
    }

    /** Incerteza cresce com o horizonte: +4% por mês à frente, até 50% a mais. */
    public static function fatorHorizonte(int $h): float
    {
        return min(1.5, 1 + 0.04 * ($h - 1));
    }

    /** O modelo participa da projeção automática? (respeita as chaves de estimativa) */
    public function projetaAutomaticamente(array $modelo): bool
    {
        if ($modelo['estimativa']['status'] !== EstimadorSerieMensal::STATUS_PROJETADA) {
            return false;
        }

        return $modelo['tipo'] === 'INCOME' ? $this->filtros->preverReceitas() : $this->filtros->preverDespesas();
    }

    /** Valor automático (sem cenário) previsto para o j-ésimo mês da projeção (0 = mês atual). */
    public function valorAutomatico(array $modelo, int $j, string $mes): float
    {
        if (!$this->projetaAutomaticamente($modelo)) {
            return 0.0;
        }

        return EstimadorSerieMensal::prever($modelo['estimativa']['modelo'], $j + 1, (int) substr($mes, 5, 2));
    }

    public function desvio(array $modelo, int $j, ?string $mes = null): float
    {
        if (!$this->projetaAutomaticamente($modelo)) {
            return 0.0;
        }

        // Periódica: só há incerteza nos meses em que a ocorrência é esperada.
        if ($mes !== null && ($modelo['estimativa']['modelo']['periodo'] ?? null) !== null && $this->valorAutomatico($modelo, $j, $mes) <= 0) {
            return 0.0;
        }

        return (float) $modelo['estimativa']['desvio'] * self::fatorHorizonte($j + 1);
    }

    /**
     * @return array{itens: array<int, array>, resumo: array<string, array<int, array>>}
     */
    public function projetar(?CenarioSimulacao $cenario, string $modo = self::MODO_BASE): array
    {
        $meses = $this->filtros->mesesProjetados();
        $totais = [];

        // 1) Total mensal por categoria, já com cenário (antes de descontar o conhecido).
        foreach ($this->modelos as $chave => $modelo) {
            foreach ($meses as $j => $mes) {
                $automatico = $this->valorAutomatico($modelo, $j, $mes);
                $total = $automatico;

                if ($modo !== self::MODO_BASE) {
                    // Pessimista: despesa acima / receita abaixo do esperado (e vice-versa).
                    $direcao = ($modo === self::MODO_PESSIMISTA) === ($modelo['tipo'] === 'EXPENSE') ? 1 : -1;
                    $total += $direcao * $this->desvio($modelo, $j, $mes) * ($this->escala[$modelo['tipo']][$mes] ?? 0.0);
                }

                $fatorRecorrencias = 1.0;
                if ($cenario !== null) {
                    $total = $this->aplicarCenario($cenario, $modelo, $total, $j, $mes);
                    $fatorRecorrencias = $this->fatorCategoria($cenario, $modelo, $mes);
                }

                $totais[$chave][$mes] = ['automatico' => round($automatico, 2), 'total' => max(0.0, $total), 'fator_recorrencias' => $fatorRecorrencias];
            }
        }

        if ($cenario !== null) {
            $totais = $this->aplicarDeltasGerais($cenario, $totais, $meses);
        }

        // 2) Reconciliação com o que já está cadastrado e distribuição em datas/meios de pagamento.
        $itens = [];
        $resumo = [];

        foreach ($this->modelos as $chave => $modelo) {
            foreach ($meses as $j => $mes) {
                ['automatico' => $automatico, 'total' => $total, 'fator_recorrencias' => $fator] = $totais[$chave][$mes];
                // Já previsto = lançado/agendado + ocorrências futuras de recorrências da categoria. As
                // recorrências entram pelo valor-base: cancelar uma assinatura na simulação não pode
                // fazer a estimativa da categoria "devolver" o valor. Só o ajuste da própria categoria
                // (que também as alcança) muda essa parte.
                $conhecido = (float) ($modelo['conhecido'][$mes] ?? 0.0) + (float) ($modelo['recorrente'][$mes] ?? 0.0) * $fator;
                $adicional = $this->adicional($modelo, $mes, $total, $conhecido);

                if ($automatico > 0 || $total > 0 || $conhecido > 0) {
                    $resumo[$chave][] = [
                        'mes' => $mes,
                        'automatico' => round($automatico, 2),
                        'previsto' => round($total, 2),
                        'conhecido' => round($conhecido, 2),
                        'adicional' => $adicional,
                    ];
                }

                if ($adicional > 0) {
                    array_push($itens, ...$this->distribuir($modelo, $mes, $j, $adicional, $total));
                }
            }
        }

        return ['itens' => $itens, 'resumo' => $resumo];
    }

    private function aplicarCenario(CenarioSimulacao $cenario, array $modelo, float $total, int $j, string $mes): float
    {
        if ($modelo['tipo'] === 'EXPENSE' && $cenario->inflacaoMensal != 0.0) {
            $total *= (1 + $cenario->inflacaoMensal / 100) ** $j;
        }

        foreach ($cenario->ajustes as $ajuste) {
            if (!CenarioSimulacao::vigente($ajuste, $mes)) {
                continue;
            }

            $geral = ($ajuste['alvo'] === 'DESPESAS_ESTIMADAS' && $modelo['tipo'] === 'EXPENSE')
                || ($ajuste['alvo'] === 'RECEITAS_ESTIMADAS' && $modelo['tipo'] === 'INCOME');

            if ($geral && $ajuste['modo'] === 'PERCENTUAL') {
                // Só mexe no que já é estimado; não cria gasto onde o sistema não previu nenhum.
                $total *= 1 + $ajuste['valor'] / 100;
                continue;
            }

            $categoria = $ajuste['alvo'] === 'CATEGORIA'
                && ($ajuste['tipo'] ?? 'EXPENSE') === $modelo['tipo']
                && (int) ($ajuste['categoria_id'] ?? 0) === (int) ($modelo['categoria_id'] ?? 0);

            if (!$categoria) {
                continue;
            }

            $total = match ($ajuste['modo']) {
                'DEFINIR' => $ajuste['valor'],
                'DELTA' => $total + $ajuste['valor'],
                default => $total * (1 + $ajuste['valor'] / 100),
            };
        }

        return max(0.0, $total);
    }

    /** Percentual que os ajustes da categoria aplicam também às recorrências dela (ver MotorSimulacao::alcanca). */
    private function fatorCategoria(CenarioSimulacao $cenario, array $modelo, string $mes): float
    {
        $fator = 1.0;

        foreach ($cenario->ajustes as $ajuste) {
            if ($ajuste['alvo'] === 'CATEGORIA' && $ajuste['modo'] === 'PERCENTUAL' && CenarioSimulacao::vigente($ajuste, $mes)
                && ($ajuste['tipo'] ?? 'EXPENSE') === $modelo['tipo']
                && (int) ($ajuste['categoria_id'] ?? 0) === (int) ($modelo['categoria_id'] ?? 0)) {
                $fator *= 1 + $ajuste['valor'] / 100;
            }
        }

        return max(0.0, $fator);
    }

    /**
     * "Economizar R$ 200/mês" nos gastos estimados: o valor sai das categorias proporcionalmente
     * ao peso de cada uma no mês (nunca abaixo de zero).
     */
    private function aplicarDeltasGerais(CenarioSimulacao $cenario, array $totais, array $meses): array
    {
        foreach ($cenario->ajustes as $ajuste) {
            if ($ajuste['modo'] !== 'DELTA' || !in_array($ajuste['alvo'], ['DESPESAS_ESTIMADAS', 'RECEITAS_ESTIMADAS'], true)) {
                continue;
            }

            $tipo = $ajuste['alvo'] === 'DESPESAS_ESTIMADAS' ? 'EXPENSE' : 'INCOME';

            foreach ($meses as $mes) {
                if (!CenarioSimulacao::vigente($ajuste, $mes)) {
                    continue;
                }

                $chaves = array_filter(array_keys($totais), fn ($chave) => $this->modelos[$chave]['tipo'] === $tipo);
                $soma = array_sum(array_map(fn ($chave) => $totais[$chave][$mes]['total'], $chaves));

                if ($soma <= 0) {
                    continue;
                }

                $fator = max(0.0, $soma + $ajuste['valor']) / $soma;
                foreach ($chaves as $chave) {
                    $totais[$chave][$mes]['total'] *= $fator;
                }
            }
        }

        return $totais;
    }

    private function adicional(array $modelo, string $mes, float $total, float $conhecido): float
    {
        if ($total <= 0) {
            return 0.0;
        }

        [$de, $ate, $dias] = $this->intervaloDoMes($mes);
        $fracao = PerfilDistribuicaoMensal::fracaoNoIntervalo($modelo['perfil'], $de, $ate, $dias);

        return round(max(0.0, min($total - $conhecido, $total * $fracao)), 2);
    }

    /**
     * Dias do mês que ainda estão por vir e dentro do horizonte.
     *
     * @return array{0: int, 1: int, 2: int} [primeiro dia, último dia, dias no mês]
     */
    private function intervaloDoMes(string $mes): array
    {
        $dias = PerfilDistribuicaoMensal::diasNoMes($mes);
        $de = $mes === $this->filtros->hoje->format('Y-m') ? $this->filtros->hoje->day : 1;
        $ate = $mes === $this->filtros->dataFinal->format('Y-m') ? $this->filtros->dataFinal->day : $dias;

        return [$de, $ate, $dias];
    }

    private function distribuir(array $modelo, string $mes, int $j, float $adicional, float $total): array
    {
        [$de, $ate, $dias] = $this->intervaloDoMes($mes);
        $partes = PerfilDistribuicaoMensal::distribuir($modelo['perfil'], $adicional, $mes, $de, $ate, $dias);
        $canais = $modelo['canais'] ?: [['canal' => "conta:{$this->contaPadrao}", 'tipo' => 'CONTA', 'id' => $this->contaPadrao, 'participacao' => 1.0]];
        $desvioMes = $this->desvio($modelo, $j, $mes);
        $estimativa = $modelo['estimativa'];

        $itens = [];
        $sequencia = 0;

        foreach ($partes as $parte) {
            $centavos = (int) round($parte['valor'] * 100);
            $restante = $centavos;

            foreach ($canais as $i => $canal) {
                $valor = $i === count($canais) - 1 ? $restante : (int) round($centavos * $canal['participacao']);
                $restante -= $valor;

                if ($valor <= 0) {
                    continue;
                }

                $valor /= 100;
                $itens[] = [
                    'id' => "estimado:{$modelo['chave']}:{$mes}:" . $sequencia++,
                    'tipo' => $modelo['tipo'],
                    'natureza' => 'ESTIMADO',
                    'origem' => 'ESTIMADO',
                    'descricao' => $modelo['categoria'] . ' (previsão)',
                    'valor' => $valor,
                    'desvio' => $total > 0 ? round($desvioMes * $valor / $total, 2) : 0.0,
                    'confianca' => $estimativa['confianca'] ?? 'BAIXA',
                    'categoria_id' => $modelo['categoria_id'],
                    'categoria' => $modelo['categoria'],
                    'chave_categoria' => $modelo['chave'],
                    'canal' => $canal['canal'],
                    'cartao_id' => $canal['tipo'] === 'CARTAO' ? $canal['id'] : null,
                    'conta_id' => $canal['tipo'] === 'CONTA' ? $canal['id'] : null,
                    'data' => $parte['data'],
                    'mes_consumo' => $mes,
                    'data_estimada' => $modelo['perfil']['padrao'] === 'NEUTRO' ? 'NEUTRA' : 'PERFIL',
                ];
            }
        }

        return $itens;
    }
}
