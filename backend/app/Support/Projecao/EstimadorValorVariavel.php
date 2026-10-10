<?php

namespace App\Support\Projecao;

/**
 * Estima o próximo valor de um lançamento recorrente de valor variável (conta de luz, água,
 * receita de comissão...) a partir dos valores que ele já teve.
 *
 * Por que não uma média simples: um único mês atípico (conta de luz com multa, bônus anual)
 * puxa a média e estraga todas as projeções seguintes. O estimador, em ordem:
 *
 *  1. Usa só as últimas MAX_AMOSTRAS ocorrências — o comportamento antigo deixa de importar.
 *  2. Descarta valores atípicos pelo escore-z modificado (mediana + MAD, Iglewicz-Hoaglin),
 *     que, ao contrário do desvio-padrão, não é contaminado pelo próprio outlier.
 *  3. Faz uma média ponderada com decaimento exponencial: os meses recentes pesam mais, então
 *     uma tendência (energia subindo, aluguel reajustado) é acompanhada sem a média "atrasar".
 *
 * Também devolve o desvio ponderado e uma confiança (ALTA/MEDIA/BAIXA) para a tela deixar claro
 * que é uma estimativa e o quanto ela é confiável.
 */
final class EstimadorValorVariavel
{
    public const MAX_AMOSTRAS = 12;

    /** A cada MEIA_VIDA ocorrências para trás, o peso da amostra cai pela metade. */
    private const MEIA_VIDA = 4.0;

    /** Escore-z modificado acima disso = valor atípico (limite clássico de 3,5). */
    private const LIMITE_OUTLIER = 3.5;

    /** Mínimo de amostras para tentar detectar outliers — com menos, qualquer valor "parece" atípico. */
    private const MIN_AMOSTRAS_OUTLIER = 5;

    /** Com menos que isso o desvio medido não é confiável; assume-se esta fração do valor. */
    private const MIN_AMOSTRAS_DESVIO = 3;
    private const DESVIO_POUCAS_AMOSTRAS = 0.30;

    /**
     * @param  array<int, float|int|string>  $valoresRecentesPrimeiro  valores históricos, do mais recente ao mais antigo
     * @return array{valor: float, desvio: float, amostras: int, confianca: string}|null  null = sem histórico
     */
    public static function estimar(array $valoresRecentesPrimeiro): ?array
    {
        $valores = array_values(array_filter(
            array_map('floatval', array_slice($valoresRecentesPrimeiro, 0, self::MAX_AMOSTRAS)),
            fn (float $valor) => $valor > 0
        ));

        if ($valores === []) {
            return null;
        }

        $valores = self::removerOutliers($valores);
        $amostras = count($valores);

        $media = self::mediaPonderada($valores);

        // Série quase constante (MAD = 0): a mediana é o "valor de sempre"; a média ponderada
        // ainda poderia ser puxada por um outlier que o MAD não conseguiu isolar.
        if ($amostras >= self::MIN_AMOSTRAS_OUTLIER && self::mad($valores) == 0.0) {
            $media = self::mediana($valores);
        }

        $desvio = $amostras >= self::MIN_AMOSTRAS_DESVIO
            ? self::desvioPonderado($valores, $media)
            : $media * self::DESVIO_POUCAS_AMOSTRAS;

        return [
            'valor' => round($media, 2),
            'desvio' => round($desvio, 2),
            'amostras' => $amostras,
            'confianca' => self::confianca($amostras, $media, $desvio),
        ];
    }

    /**
     * @param  float[]  $valores
     * @return float[]
     */
    private static function removerOutliers(array $valores): array
    {
        if (count($valores) < self::MIN_AMOSTRAS_OUTLIER) {
            return $valores;
        }

        $mediana = self::mediana($valores);
        $mad = self::mad($valores);

        if ($mad == 0.0) {
            // Maioria idêntica: o que diverge muito da mediana é exceção.
            $filtrados = array_values(array_filter(
                $valores,
                fn (float $v) => abs($v - $mediana) <= $mediana * 0.5
            ));

            return $filtrados === [] ? $valores : $filtrados;
        }

        $filtrados = array_values(array_filter(
            $valores,
            fn (float $v) => abs(0.6745 * ($v - $mediana) / $mad) <= self::LIMITE_OUTLIER
        ));

        return $filtrados === [] ? $valores : $filtrados;
    }

    /** @param float[] $valores mais recente primeiro */
    private static function mediaPonderada(array $valores): float
    {
        $somaPesos = 0.0;
        $soma = 0.0;

        foreach ($valores as $i => $valor) {
            $peso = 0.5 ** ($i / self::MEIA_VIDA);
            $somaPesos += $peso;
            $soma += $peso * $valor;
        }

        return $soma / $somaPesos;
    }

    /** @param float[] $valores mais recente primeiro */
    private static function desvioPonderado(array $valores, float $media): float
    {
        $somaPesos = 0.0;
        $soma = 0.0;

        foreach ($valores as $i => $valor) {
            $peso = 0.5 ** ($i / self::MEIA_VIDA);
            $somaPesos += $peso;
            $soma += $peso * ($valor - $media) ** 2;
        }

        return sqrt($soma / $somaPesos);
    }

    /** @param float[] $valores */
    private static function mediana(array $valores): float
    {
        sort($valores);
        $n = count($valores);
        $meio = intdiv($n, 2);

        return $n % 2 === 1 ? $valores[$meio] : ($valores[$meio - 1] + $valores[$meio]) / 2;
    }

    /** Desvio absoluto mediano: mediana de |x - mediana|. */
    private static function mad(array $valores): float
    {
        $mediana = self::mediana($valores);

        return self::mediana(array_map(fn (float $v) => abs($v - $mediana), $valores));
    }

    private static function confianca(int $amostras, float $media, float $desvio): string
    {
        $coeficienteVariacao = $media > 0 ? $desvio / $media : 1.0;

        if ($amostras >= 6 && $coeficienteVariacao <= 0.15) {
            return 'ALTA';
        }

        if ($amostras >= 3 && $coeficienteVariacao <= 0.35) {
            return 'MEDIA';
        }

        return 'BAIXA';
    }
}
