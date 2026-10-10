<?php

namespace App\Support\Simulador;

/**
 * Em que parte do mês uma categoria costuma acontecer — para dar DATA aos gastos estimados.
 * A data importa: R$ 700 de mercado no dia 2 ou no dia 28 mudam o menor saldo do mês e, no
 * cartão, até a fatura em que a compra cai.
 *
 * O mês é dividido em 4 faixas (1-7, 8-14, 15-21, 22-fim). O peso de cada faixa vem do valor
 * histórico gasto nela, puxado 20% para a distribuição uniforme (um único mês não decide o padrão).
 * Com menos de 3 ocorrências não há padrão: distribuição neutra, e as datas ficam marcadas como tal.
 * Para saber quanto do mês corrente "ainda falta", com 6+ ocorrências usa-se a distribuição real por
 * dia (sem o puxão para o uniforme, que inventaria gasto depois do dia em que ele sempre acontece).
 */
final class PerfilDistribuicaoMensal
{
    public const FAIXAS = [[1, 7], [8, 14], [15, 21], [22, 31]];
    private const DIA_CENTRAL = [4, 11, 18, 26];
    private const MIN_OCORRENCIAS = 3;
    /** A partir daqui, a fração "que ainda falta" no mês corrente usa a distribuição real por dia. */
    private const MIN_OCORRENCIAS_EMPIRICO = 6;
    private const ENCOLHIMENTO = 0.2;
    /** Faixa com menos que isso do valor não vira lançamento próprio (vai para a maior faixa). */
    private const PARTICIPACAO_MINIMA = 0.05;

    /**
     * @param  array<int, array{0: int, 1: float}>  $ocorrencias  pares [dia do mês, valor]
     * @return array{pesos: float[], dias: int[], padrao: string, ocorrencias: int}
     */
    public static function aPartirDe(array $ocorrencias): array
    {
        $quantidade = count($ocorrencias);

        if ($quantidade < self::MIN_OCORRENCIAS) {
            return ['pesos' => [0.25, 0.25, 0.25, 0.25], 'dias' => self::DIA_CENTRAL, 'padrao' => 'NEUTRO', 'ocorrencias' => $quantidade, 'por_dia' => null];
        }

        $valores = [0.0, 0.0, 0.0, 0.0];
        $porDia = array_fill(1, 31, 0.0);
        $diasPorFaixa = [[], [], [], []];

        foreach ($ocorrencias as [$dia, $valor]) {
            $faixa = self::faixaDoDia($dia);
            $valores[$faixa] += max(0.0, $valor);
            $diasPorFaixa[$faixa][] = [$dia, max(0.0, $valor)];
            $porDia[max(1, min(31, $dia))] += max(0.0, $valor);
        }

        $total = array_sum($valores);
        if ($total <= 0) {
            return ['pesos' => [0.25, 0.25, 0.25, 0.25], 'dias' => self::DIA_CENTRAL, 'padrao' => 'NEUTRO', 'ocorrencias' => $quantidade, 'por_dia' => null];
        }

        $beta = $total * self::ENCOLHIMENTO;
        $pesos = array_map(fn (float $v) => round(($v + $beta / 4) / ($total + $beta), 4), $valores);

        $dias = [];
        foreach ($diasPorFaixa as $i => $lista) {
            $dias[$i] = $lista === [] ? self::DIA_CENTRAL[$i] : self::diaMedianoPonderado($lista);
        }

        return [
            'pesos' => $pesos,
            'dias' => $dias,
            'padrao' => self::padrao($pesos),
            'ocorrencias' => $quantidade,
            'por_dia' => $quantidade >= self::MIN_OCORRENCIAS_EMPIRICO
                ? array_values(array_map(fn (float $v) => round($v / $total, 4), $porDia))
                : null,
        ];
    }

    /**
     * Fração do mês (pelo perfil) que ainda cabe nos dias [diaDe, diaAte] — para o mês corrente,
     * quanto do gasto típico ainda "falta acontecer". Dias são inteiros do mês (rápido: roda
     * para cada categoria × mês × cenário).
     */
    public static function fracaoNoIntervalo(array $perfil, int $diaDe, int $diaAte, int $diasNoMes): float
    {
        // Histórico farto: a parcela real do valor que costuma cair nesses dias (salário sempre no
        // dia 1 → no dia 10 não falta nada). Dias 29-31 de meses curtos contam no último dia.
        if (($perfil['por_dia'] ?? null) !== null) {
            $fracao = 0.0;
            foreach ($perfil['por_dia'] as $i => $parte) {
                $dia = min($i + 1, $diasNoMes);
                if ($dia >= $diaDe && $dia <= $diaAte) {
                    $fracao += $parte;
                }
            }

            return min(1.0, $fracao);
        }

        $fracao = 0.0;
        foreach (self::faixasNoIntervalo($perfil, $diaDe, $diaAte, $diasNoMes) as $faixa) {
            $fracao += $faixa['peso'];
        }

        return min(1.0, $fracao);
    }

    /**
     * Distribui um valor entre as faixas do mês dentro de [diaDe, diaAte], proporcional ao perfil.
     * Fecha a soma em centavos (o resto vai para a última parte).
     *
     * @param  string  $mes  'Y-m'
     * @return array<int, array{data: string, valor: float}>
     */
    public static function distribuir(array $perfil, float $valor, string $mes, int $diaDe, int $diaAte, int $diasNoMes): array
    {
        $faixas = self::faixasNoIntervalo($perfil, $diaDe, $diaAte, $diasNoMes);
        $pesos = array_column($faixas, 'peso');
        $soma = array_sum($pesos);

        if ($valor <= 0 || $faixas === [] || $soma <= 0) {
            return [];
        }

        // Faixas irrelevantes somem e o peso vai para a mais pesada.
        $maior = array_search(max($pesos), $pesos, true);
        foreach ($faixas as $i => $faixa) {
            if ($i !== $maior && $faixa['peso'] / $soma < self::PARTICIPACAO_MINIMA) {
                $faixas[$maior]['peso'] += $faixa['peso'];
                unset($faixas[$i]);
            }
        }
        $faixas = array_values($faixas);

        $centavos = (int) round($valor * 100);
        $restante = $centavos;
        $partes = [];

        foreach ($faixas as $i => $faixa) {
            $parte = $i === count($faixas) - 1 ? $restante : (int) round($centavos * $faixa['peso'] / $soma);
            $restante -= $parte;

            if ($parte > 0) {
                $partes[] = ['data' => $mes . '-' . str_pad((string) $faixa['dia'], 2, '0', STR_PAD_LEFT), 'valor' => $parte / 100];
            }
        }

        return $partes;
    }

    public static function diasNoMes(string $mes): int
    {
        return (int) date('t', strtotime("{$mes}-01"));
    }

    /**
     * Faixas do mês que caem (total ou parcialmente) em [diaDe, diaAte], com o peso proporcional
     * aos dias que sobram e o dia em que o lançamento estimado vai cair.
     *
     * @return array<int, array{peso: float, dia: int}>
     */
    private static function faixasNoIntervalo(array $perfil, int $diaDe, int $diaAte, int $diasNoMes): array
    {
        $faixas = [];

        foreach (self::FAIXAS as $i => [$primeiro, $ultimo]) {
            $ultimo = min($ultimo, $diasNoMes);
            $de = max($primeiro, $diaDe);
            $ate = min($ultimo, $diaAte);

            if ($de > $ate) {
                continue;
            }

            $dia = min($perfil['dias'][$i], $diasNoMes);

            $faixas[] = [
                'peso' => $perfil['pesos'][$i] * ($ate - $de + 1) / ($ultimo - $primeiro + 1),
                'dia' => max($de, min($ate, $dia)),
            ];
        }

        return $faixas;
    }

    private static function faixaDoDia(int $dia): int
    {
        foreach (self::FAIXAS as $i => [$primeiro, $ultimo]) {
            if ($dia >= $primeiro && $dia <= $ultimo) {
                return $i;
            }
        }

        return 3;
    }

    /** @param array<int, array{0: int, 1: float}> $lista */
    private static function diaMedianoPonderado(array $lista): int
    {
        usort($lista, fn ($a, $b) => $a[0] <=> $b[0]);
        $total = array_sum(array_column($lista, 1));

        if ($total <= 0) {
            return $lista[intdiv(count($lista), 2)][0];
        }

        $acumulado = 0.0;
        foreach ($lista as [$dia, $valor]) {
            $acumulado += $valor;
            if ($acumulado >= $total / 2) {
                return $dia;
            }
        }

        return end($lista)[0];
    }

    private static function padrao(array $pesos): string
    {
        $maior = max($pesos);
        $indice = array_search($maior, $pesos, true);

        if ($maior < 0.45) {
            return 'DISTRIBUIDO';
        }

        return match ($indice) {
            0 => 'INICIO',
            3 => 'FIM',
            default => 'MEIO',
        };
    }
}
