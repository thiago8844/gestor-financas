<?php

namespace App\Support\Simulador;

use App\Support\Projecao\EstimadorValorVariavel;

/**
 * Prevê o total mensal de uma categoria (supermercado, combustível, freelas...) a partir da série
 * de meses completos — incluindo os meses em que não houve gasto, que o EstimadorValorVariavel
 * (feito para o valor de UMA recorrência) descarta.
 *
 * Em vez de um algoritmo único para tudo, testa alguns métodos simples e verificáveis contra o
 * próprio passado (validação "rolling origin": prevê cada um dos últimos meses usando só os meses
 * anteriores a ele) e fica com o que errou menos. O método padrão só é trocado se outro errar
 * claramente menos — evita escolher um método "esperto" por sorte. Gastos intermitentes ficam
 * sempre no padrão (valor esperado), porque o erro absoluto premiaria "prever zero".
 *
 *  - media_ponderada_robusta: frequência de ocorrência × valor típico, sendo o valor típico a
 *    mesma regra do EstimadorValorVariavel (sem outliers, peso maior para meses recentes).
 *    Para um gasto de todo mês vira o próprio valor típico; para um esporádico (manutenção da
 *    moto 3x ao ano), o valor esperado por mês.
 *  - mediana_recente: mediana dos últimos 6 meses (zeros incluídos).
 *  - suavizacao_exponencial: suavização exponencial simples sobre a série com picos limitados.
 *  - tendencia_limitada: valor típico + inclinação robusta (Theil-Sen), com variação total
 *    limitada a ±25% — tendência só se o histórico sustentar e nunca extrapolando sem freio.
 *  - sazonal: com 2+ anos de histórico, ajusta pelo fator do mês do ano (amortecido).
 *  - periodica: quando o lançamento acontece a cada N meses certinho (venda de grãos trimestral,
 *    seguro semestral), o valor típico é previsto NOS meses em que deve ocorrer — em vez de diluído
 *    por todos os meses (errado para o caixa) ou descartado como eventual.
 */
final class EstimadorSerieMensal
{
    public const STATUS_PROJETADA = 'PROJETADA';
    public const STATUS_INSUFICIENTE = 'INSUFICIENTE';
    /** Receita que aparece de vez em quando: não se assume que vai se repetir. */
    public const STATUS_EVENTUAL = 'EVENTUAL';

    public const METODOS = [
        'media_ponderada_robusta' => 'Média ponderada robusta (frequência × valor típico)',
        'mediana_recente' => 'Mediana dos últimos meses',
        'suavizacao_exponencial' => 'Suavização exponencial',
        'tendencia_limitada' => 'Média ponderada com tendência limitada',
        'sazonal' => 'Média ponderada com sazonalidade anual',
        'periodica' => 'Ocorrência periódica detectada',
    ];

    private const PADRAO = 'media_ponderada_robusta';

    /** Mesmo decaimento do EstimadorValorVariavel: a cada 4 meses para trás, o peso cai pela metade. */
    private const MEIA_VIDA = 4.0;
    private const ALFA_SUAVIZACAO = 0.35;
    private const JANELA_MEDIANA = 6;
    private const LIMITE_TENDENCIA = 0.25;
    /** Outro método precisa errar ao menos 10% menos que o padrão para ser escolhido. */
    private const VANTAGEM_MINIMA = 0.9;
    private const MAX_MESES_VALIDACAO = 6;
    /** Abaixo dessa frequência de ocorrência, o método fica sempre no padrão (valor esperado). */
    private const FREQUENCIA_MINIMA_SELECAO = 0.6;

    /**
     * @param  float[]   $serie  totais mensais, do mais ANTIGO ao mais recente (só meses completos)
     * @param  string[]  $meses  chaves 'Y-m' de cada posição da série (usadas na sazonalidade)
     */
    public static function estimar(array $serie, bool $receita = false, array $meses = []): array
    {
        $serie = array_values(array_map(fn ($v) => max(0.0, (float) $v), $serie));
        $n = count($serie);
        $comValor = count(array_filter($serie, fn (float $v) => $v > 0));
        $estatisticas = self::estatisticas($serie);

        $base = [
            'metodo' => null,
            'metodo_rotulo' => null,
            'valor' => null,
            'desvio' => null,
            'confianca' => null,
            'modelo' => null,
            'estatisticas' => $estatisticas,
            'validacao' => null,
        ];

        // Uma ocorrência só não é padrão — é um evento. Receita ainda exige regularidade.
        if ($comValor < 2) {
            return ['status' => self::STATUS_INSUFICIENTE, 'motivo' => $comValor === 0
                ? 'Sem lançamentos no período analisado.'
                : 'Só um mês com lançamentos no período analisado — pouco para identificar um padrão.', ...$base];
        }

        $periodica = self::periodicidade($serie);
        if ($periodica !== null) {
            return self::estimativaPeriodica($serie, $periodica, $estatisticas, $base);
        }

        if ($receita && ($comValor < 3 || $estatisticas['frequencia'] < 0.5)) {
            return ['status' => self::STATUS_EVENTUAL, 'motivo' => 'Receita eventual (aparece em menos da metade dos meses): não é projetada, para não contar com dinheiro incerto.', ...$base];
        }

        $validacao = self::validar($serie, $meses);
        $metodo = $validacao['escolhido'] ?? self::PADRAO;

        // Gasto intermitente (moto, presentes): pelo erro absoluto, "prever zero" quase sempre
        // vence — e subestima o custo real. Para caixa, o certo é o valor esperado por mês.
        if ($estatisticas['frequencia'] < self::FREQUENCIA_MINIMA_SELECAO) {
            $metodo = self::PADRAO;
        }
        $modelo = self::ajustar($metodo, $serie, $meses);
        $valor = round(self::prever($modelo, 1, self::mesDoAnoSeguinte($meses)), 2);

        $desvio = $validacao !== null
            ? $validacao['rmse'][$metodo]
            : ($n >= 3 ? self::desvioPadrao($serie) : $valor * 0.3);

        $wape = $validacao['wape'][$metodo] ?? null;

        return [
            'status' => self::STATUS_PROJETADA,
            'motivo' => null,
            'metodo' => $metodo,
            'metodo_rotulo' => self::METODOS[$metodo],
            'valor' => $valor,
            'desvio' => round($desvio, 2),
            'confianca' => self::confianca($n, $estatisticas['frequencia'], $valor, $desvio, $wape),
            'modelo' => $modelo,
            'estatisticas' => $estatisticas,
            'validacao' => $validacao === null ? null : [
                'meses' => $validacao['meses'],
                'mae' => round($validacao['mae'][$metodo], 2),
                'wape' => $wape === null ? null : round($wape, 3),
                'metodos' => array_map(fn ($mae) => round($mae, 2), $validacao['mae']),
            ],
        ];
    }

    /**
     * Valor previsto para o h-ésimo mês após o último mês do histórico (h = 1 é o mês atual).
     *
     * @param  int|null  $mesDoAno  1-12, para o modelo sazonal
     */
    public static function prever(array $modelo, int $h, ?int $mesDoAno = null): float
    {
        if (($modelo['periodo'] ?? null) !== null) {
            return ($h + $modelo['meses_desde_ultima']) % $modelo['periodo'] === 0 ? $modelo['nivel'] : 0.0;
        }

        $valor = $modelo['nivel'];

        if ($modelo['inclinacao'] != 0.0) {
            $variacao = $modelo['inclinacao'] * ($h + $modelo['defasagem']);
            $limite = abs($modelo['nivel']) * self::LIMITE_TENDENCIA;
            $valor += max(-$limite, min($limite, $variacao));
        }

        if ($modelo['fatores'] !== null && $mesDoAno !== null) {
            $valor *= $modelo['fatores'][$mesDoAno] ?? 1.0;
        }

        return max(0.0, $valor);
    }

    // -=-=-=- MÉTODOS -=-=-=-

    /**
     * Ajusta o método à série e devolve um modelo serializável (nível, inclinação, fatores).
     *
     * @return array{metodo: string, nivel: float, inclinacao: float, defasagem: float, fatores: array<int, float>|null}
     */
    private static function ajustar(string $metodo, array $serie, array $meses): array
    {
        $modelo = ['metodo' => $metodo, 'nivel' => 0.0, 'inclinacao' => 0.0, 'defasagem' => 0.0, 'fatores' => null];

        switch ($metodo) {
            case 'mediana_recente':
                $modelo['nivel'] = self::mediana(array_slice($serie, -self::JANELA_MEDIANA));
                break;

            case 'suavizacao_exponencial':
                $modelo['nivel'] = self::suavizar(self::limitarPicos($serie));
                break;

            case 'tendencia_limitada':
                $modelo['nivel'] = self::mediaPonderadaRobusta($serie);
                $modelo['inclinacao'] = self::theilSen(array_slice($serie, -12));
                // A média ponderada "mora" alguns meses no passado; a tendência compensa essa defasagem.
                $modelo['defasagem'] = self::idadeMediaPonderada(count($serie));
                break;

            case 'sazonal':
                $fatores = self::fatoresSazonais($serie, $meses);
                $dessazonalizada = [];
                foreach ($serie as $i => $v) {
                    $mesDoAno = (int) substr($meses[$i], 5, 2);
                    $dessazonalizada[] = $v / ($fatores[$mesDoAno] ?: 1.0);
                }
                $modelo['nivel'] = self::mediaPonderadaRobusta($dessazonalizada);
                $modelo['fatores'] = $fatores;
                break;

            default:
                $modelo['nivel'] = self::mediaPonderadaRobusta($serie);
        }

        return $modelo;
    }

    private static function metodosAplicaveis(int $tamanhoTreino, array $meses): array
    {
        $metodos = ['media_ponderada_robusta', 'mediana_recente', 'suavizacao_exponencial'];

        if ($tamanhoTreino >= 6) {
            $metodos[] = 'tendencia_limitada';
        }

        if ($tamanhoTreino >= 24 && count($meses) >= $tamanhoTreino) {
            $metodos[] = 'sazonal';
        }

        return $metodos;
    }

    /**
     * Validação "rolling origin": para cada um dos últimos k meses, ajusta cada método só com os
     * meses anteriores e mede o erro da previsão daquele mês. Nada do futuro vaza para o passado.
     *
     * @return array{meses: int, mae: array<string, float>, rmse: array<string, float>, wape: array<string, float|null>, escolhido: string}|null
     */
    private static function validar(array $serie, array $meses): ?array
    {
        $n = count($serie);
        $k = min(self::MAX_MESES_VALIDACAO, $n - 4);

        if ($k < 3) {
            return null;
        }

        // Só concorre quem consegue prever TODOS os meses de validação.
        $metodos = self::metodosAplicaveis($n - $k, $meses);
        $erros = array_fill_keys($metodos, []);
        $somaReal = 0.0;

        for ($t = $n - $k; $t < $n; $t++) {
            $treino = array_slice($serie, 0, $t);
            $mesesTreino = array_slice($meses, 0, $t);
            $mesAlvo = isset($meses[$t]) ? (int) substr($meses[$t], 5, 2) : null;
            $somaReal += $serie[$t];

            foreach ($metodos as $metodo) {
                $previsto = self::prever(self::ajustar($metodo, $treino, $mesesTreino), 1, $mesAlvo);
                $erros[$metodo][] = $previsto - $serie[$t];
            }
        }

        $mae = [];
        $rmse = [];
        $wape = [];
        foreach ($erros as $metodo => $lista) {
            $absolutos = array_map('abs', $lista);
            $mae[$metodo] = array_sum($absolutos) / count($lista);
            $rmse[$metodo] = sqrt(array_sum(array_map(fn ($e) => $e ** 2, $lista)) / count($lista));
            // WAPE (erro absoluto ponderado): estável mesmo com meses de valor zero, ao contrário do MAPE.
            $wape[$metodo] = $somaReal > 0 ? array_sum($absolutos) / $somaReal : null;
        }

        $escolhido = self::PADRAO;
        foreach ($mae as $metodo => $erro) {
            if ($erro < $mae[$escolhido] && $erro < $mae[self::PADRAO] * self::VANTAGEM_MINIMA) {
                $escolhido = $metodo;
            }
        }

        return ['meses' => $k, 'mae' => $mae, 'rmse' => $rmse, 'wape' => $wape, 'escolhido' => $escolhido];
    }

    // -=-=-=- PERIODICIDADE -=-=-=-

    /**
     * Intervalo (em meses) entre as ocorrências, se for constante: ao menos 3 ocorrências, todos os
     * intervalos iguais (2 a 12 meses) e a última ocorrência recente o bastante para o padrão estar vivo.
     * Intervalo 1 é "todo mês" — já coberto pelos outros métodos.
     */
    private static function periodicidade(array $serie): ?int
    {
        $posicoes = array_keys(array_filter($serie, fn (float $v) => $v > 0));

        if (count($posicoes) < 3) {
            return null;
        }

        $intervalos = [];
        for ($i = 1; $i < count($posicoes); $i++) {
            $intervalos[] = $posicoes[$i] - $posicoes[$i - 1];
        }

        $periodo = $intervalos[0];
        if ($periodo < 2 || $periodo > 12 || count(array_unique($intervalos)) !== 1) {
            return null;
        }

        // Padrão "morto": já passou mais de um período inteiro desde a última vez.
        $mesesDesdeUltima = count($serie) - 1 - end($posicoes);

        return $mesesDesdeUltima < $periodo ? $periodo : null;
    }

    private static function estimativaPeriodica(array $serie, int $periodo, array $estatisticas, array $base): array
    {
        $ocorrencias = array_values(array_filter($serie, fn (float $v) => $v > 0));
        $tipico = EstimadorValorVariavel::estimar(array_reverse($ocorrencias));
        $posicoes = array_keys(array_filter($serie, fn (float $v) => $v > 0));

        $modelo = [
            'metodo' => 'periodica',
            'nivel' => $tipico['valor'],
            'inclinacao' => 0.0,
            'defasagem' => 0.0,
            'fatores' => null,
            'periodo' => $periodo,
            'meses_desde_ultima' => count($serie) - 1 - end($posicoes),
        ];

        $cv = $tipico['valor'] > 0 ? $tipico['desvio'] / $tipico['valor'] : 1.0;
        $confianca = match (true) {
            count($ocorrencias) >= 4 && $cv <= 0.15 => 'ALTA',
            $cv <= 0.35 => 'MEDIA',
            default => 'BAIXA',
        };

        return [
            ...$base,
            'status' => self::STATUS_PROJETADA,
            'motivo' => null,
            'metodo' => 'periodica',
            'metodo_rotulo' => self::METODOS['periodica'] . " (a cada {$periodo} meses)",
            'valor' => $tipico['valor'],
            'desvio' => $tipico['desvio'],
            'confianca' => $confianca,
            'modelo' => $modelo,
            'estatisticas' => [...$estatisticas, 'periodo_meses' => $periodo],
        ];
    }

    // -=-=-=- BLOCOS ESTATÍSTICOS -=-=-=-

    /** Frequência ponderada de meses com valor × valor típico (regra do EstimadorValorVariavel). */
    private static function mediaPonderadaRobusta(array $serie): float
    {
        $recentesPrimeiro = array_reverse($serie);
        $somaPesos = 0.0;
        $pesoComValor = 0.0;

        foreach ($recentesPrimeiro as $i => $v) {
            $peso = 0.5 ** ($i / self::MEIA_VIDA);
            $somaPesos += $peso;
            $pesoComValor += $v > 0 ? $peso : 0.0;
        }

        $tipico = EstimadorValorVariavel::estimar($recentesPrimeiro);

        if ($tipico === null || $somaPesos == 0.0) {
            return 0.0;
        }

        return ($pesoComValor / $somaPesos) * $tipico['valor'];
    }

    /** Idade média (em meses) ponderada pelos pesos da média ponderada — a "defasagem" dela. */
    private static function idadeMediaPonderada(int $n): float
    {
        $somaPesos = 0.0;
        $soma = 0.0;
        $limite = min($n, EstimadorValorVariavel::MAX_AMOSTRAS);

        for ($i = 0; $i < $limite; $i++) {
            $peso = 0.5 ** ($i / self::MEIA_VIDA);
            $somaPesos += $peso;
            $soma += $peso * $i;
        }

        return $somaPesos > 0 ? $soma / $somaPesos : 0.0;
    }

    private static function suavizar(array $serie): float
    {
        $inicio = array_slice($serie, 0, 3);
        $nivel = array_sum($inicio) / max(1, count($inicio));

        foreach ($serie as $v) {
            $nivel = self::ALFA_SUAVIZACAO * $v + (1 - self::ALFA_SUAVIZACAO) * $nivel;
        }

        return $nivel;
    }

    /** Limita picos isolados (mediana + 3,5 MADs dos meses com valor) antes de suavizar. */
    private static function limitarPicos(array $serie): array
    {
        $comValor = array_values(array_filter($serie, fn ($v) => $v > 0));

        if (count($comValor) < 5) {
            return $serie;
        }

        $mediana = self::mediana($comValor);
        $mad = self::mediana(array_map(fn ($v) => abs($v - $mediana), $comValor));

        if ($mad == 0.0) {
            return $serie;
        }

        $teto = $mediana + 3.5 * $mad / 0.6745;

        return array_map(fn ($v) => min($v, $teto), $serie);
    }

    /** Inclinação de Theil-Sen: mediana das inclinações entre todos os pares — imune a um mês atípico. */
    private static function theilSen(array $serie): float
    {
        $n = count($serie);
        $inclinacoes = [];

        for ($i = 0; $i < $n; $i++) {
            for ($j = $i + 1; $j < $n; $j++) {
                $inclinacoes[] = ($serie[$j] - $serie[$i]) / ($j - $i);
            }
        }

        return $inclinacoes === [] ? 0.0 : self::mediana($inclinacoes);
    }

    /**
     * Fator de cada mês do ano (média daquele mês ÷ média geral), amortecido pela metade e
     * limitado a [0,5; 2] — um único dezembro caro não pode dobrar todos os dezembros.
     *
     * @return array<int, float>
     */
    private static function fatoresSazonais(array $serie, array $meses): array
    {
        $media = array_sum($serie) / max(1, count($serie));
        $porMes = [];

        foreach ($serie as $i => $v) {
            $porMes[(int) substr($meses[$i], 5, 2)][] = $v;
        }

        $fatores = [];
        for ($m = 1; $m <= 12; $m++) {
            if ($media <= 0 || !isset($porMes[$m])) {
                $fatores[$m] = 1.0;
                continue;
            }

            $bruto = (array_sum($porMes[$m]) / count($porMes[$m])) / $media;
            $fatores[$m] = max(0.5, min(2.0, 1 + 0.5 * ($bruto - 1)));
        }

        return $fatores;
    }

    private static function estatisticas(array $serie): array
    {
        $n = count($serie);
        $comValor = array_values(array_filter($serie, fn ($v) => $v > 0));
        $media = $n > 0 ? array_sum($serie) / $n : 0.0;
        $desvio = $n >= 2 ? self::desvioPadrao($serie) : 0.0;
        $atipicos = EstimadorValorVariavel::indicesAtipicos($comValor);

        // Índices de atípicos são sobre os meses com valor; traduz para posições da série.
        $posicoesComValor = array_keys(array_filter($serie, fn ($v) => $v > 0));
        $atipicosSerie = array_map(fn ($i) => $posicoesComValor[$i], $atipicos);

        $tendencia = null;
        if ($n >= 4 && $media > 0) {
            $relativa = self::theilSen(array_slice($serie, -12)) / $media;
            $tendencia = [
                'classificacao' => abs($relativa) < 0.02 ? 'ESTAVEL' : ($relativa > 0 ? 'SUBINDO' : 'CAINDO'),
                'variacao_mensal_pct' => round($relativa * 100, 1),
            ];
        }

        return [
            'meses' => $n,
            'meses_com_valor' => count($comValor),
            'frequencia' => $n > 0 ? round(count($comValor) / $n, 3) : 0.0,
            'media' => round($media, 2),
            'mediana' => round($n > 0 ? self::mediana($serie) : 0.0, 2),
            'minimo' => round($n > 0 ? min($serie) : 0.0, 2),
            'maximo' => round($n > 0 ? max($serie) : 0.0, 2),
            'valor_tipico' => ($t = EstimadorValorVariavel::estimar(array_reverse($serie))) ? $t['valor'] : null,
            'coeficiente_variacao' => $media > 0 ? round($desvio / $media, 3) : null,
            'tendencia' => $tendencia,
            'atipicos' => array_values($atipicosSerie),
        ];
    }

    private static function confianca(int $n, float $frequencia, float $valor, float $desvio, ?float $wape): string
    {
        $cv = $valor > 0 ? $desvio / $valor : 1.0;
        $erro = $wape ?? $cv;

        if ($n >= 6 && $frequencia >= 0.75 && $erro <= ($wape !== null ? 0.20 : 0.15)) {
            return 'ALTA';
        }

        if ($n >= 3 && $erro <= ($wape !== null ? 0.45 : 0.40)) {
            return 'MEDIA';
        }

        return 'BAIXA';
    }

    private static function mesDoAnoSeguinte(array $meses): ?int
    {
        if ($meses === []) {
            return null;
        }

        $ultimo = (int) substr(end($meses), 5, 2);

        return $ultimo % 12 + 1;
    }

    private static function mediana(array $valores): float
    {
        if ($valores === []) {
            return 0.0;
        }

        sort($valores);
        $n = count($valores);
        $meio = intdiv($n, 2);

        return $n % 2 === 1 ? (float) $valores[$meio] : ($valores[$meio - 1] + $valores[$meio]) / 2;
    }

    private static function desvioPadrao(array $valores): float
    {
        $n = count($valores);
        if ($n < 2) {
            return 0.0;
        }

        $media = array_sum($valores) / $n;

        return sqrt(array_sum(array_map(fn ($v) => ($v - $media) ** 2, $valores)) / ($n - 1));
    }
}
