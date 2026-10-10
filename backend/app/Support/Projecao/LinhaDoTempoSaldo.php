<?php

namespace App\Support\Projecao;

use Carbon\Carbon;

/**
 * Aplica os eventos, em ordem cronológica, ao saldo atual das contas — dia a dia — e devolve a
 * evolução do saldo por mês, o menor saldo previsto e os alertas de saldo negativo.
 *
 * O saldo considerado é o do FIM de cada dia: dentro do mesmo dia entradas e saídas se compensam
 * (o salário que cai de manhã cobre o aluguel da tarde), então não gera alerta falso.
 */
final class LinhaDoTempoSaldo
{
    private const CHAVE_GLOBAL = 'global';

    /**
     * @param  array<int, float>  $saldosIniciais  saldo atual por conta
     * @param  array<int, array>  $eventos         saída do GeradorEventosFinanceiros
     * @param  array<int, string>  $nomesContas
     * @return array{eventos: array, meses: array, serie_diaria: array, contas: array, alertas: array, menor_saldo: array, saldo_final: float}
     */
    public static function calcular(
        array $saldosIniciais,
        array $eventos,
        Carbon $hoje,
        Carbon $fim,
        array $nomesContas
    ): array {
        usort($eventos, fn (array $a, array $b) => [$a['data'], $a['tipo'] === 'INCOME' ? 0 : 1, $a['descricao']]
            <=> [$b['data'], $b['tipo'] === 'INCOME' ? 0 : 1, $b['descricao']]);

        $saldoPorConta = $saldosIniciais;
        $saldo = round(array_sum($saldoPorConta), 2);
        $hojeStr = $hoje->toDateString();

        $monitores = [self::CHAVE_GLOBAL => self::novoMonitor($saldo, $hojeStr)];
        foreach ($saldoPorConta as $contaId => $saldoConta) {
            $monitores[$contaId] = self::novoMonitor($saldoConta, $hojeStr);
        }

        $meses = self::mesesVazios($hoje, $fim);
        $serieDiaria = [['data' => $hojeStr, 'saldo' => $saldo]];
        $variancia = 0.0;

        // Agrupa por dia mantendo a ordem já definida.
        $porDia = [];
        foreach ($eventos as $indice => $evento) {
            $porDia[$evento['data']][] = $indice;
        }

        $mesAnterior = null;

        foreach ($porDia as $dia => $indices) {
            $mes = substr($dia, 0, 7);

            if (!isset($meses[$mes])) {
                $meses[$mes] = self::mesVazio($mes);
            }

            // Meses sem nenhum evento herdam o saldo do mês anterior (preenchidos no fim).
            if ($meses[$mes]['saldo_inicial'] === null) {
                $meses[$mes]['saldo_inicial'] = $saldo;
                $meses[$mes]['saldo_minimo'] = $saldo;
                $meses[$mes]['data_saldo_minimo'] = $mes === substr($hojeStr, 0, 7) ? $hojeStr : "{$mes}-01";
            }

            $contasDoDia = [];

            foreach ($indices as $indice) {
                $evento = &$eventos[$indice];
                $valor = $evento['valor'] ?? 0.0;
                $delta = $evento['tipo'] === 'INCOME' ? $valor : -$valor;

                $saldo = round($saldo + $delta, 2);
                $saldoPorConta[$evento['conta_id']] = round(($saldoPorConta[$evento['conta_id']] ?? 0.0) + $delta, 2);
                $contasDoDia[$evento['conta_id']] = true;
                $evento['saldo_apos'] = $saldo;

                if ($evento['tipo'] === 'INCOME') {
                    $meses[$mes]['entradas'] = round($meses[$mes]['entradas'] + $valor, 2);
                    $meses[$mes]['entradas_estimadas'] += $evento['estimado'] ? $valor : 0.0;
                } else {
                    $meses[$mes]['saidas'] = round($meses[$mes]['saidas'] + $valor, 2);
                    $meses[$mes]['saidas_estimadas'] += $evento['estimado'] ? $valor : 0.0;
                }

                $meses[$mes]['quantidade']++;
                $meses[$mes]['sem_valor'] += $evento['itens_sem_valor'];
                $variancia += $evento['estimado'] ? ($evento['desvio'] ?? 0.0) ** 2 : 0.0;

                unset($evento);
            }

            if ($saldo < $meses[$mes]['saldo_minimo']) {
                $meses[$mes]['saldo_minimo'] = $saldo;
                $meses[$mes]['data_saldo_minimo'] = $dia;
            }

            $meses[$mes]['saldo_final'] = $saldo;
            $meses[$mes]['incerteza'] = round(sqrt($variancia), 2);

            self::atualizarMonitor($monitores[self::CHAVE_GLOBAL], $saldo, $dia, self::maiorSaidaDoDia($eventos, $indices, null));
            foreach (array_keys($contasDoDia) as $contaId) {
                $monitores[$contaId] ??= self::novoMonitor(0.0, $hojeStr);
                self::atualizarMonitor(
                    $monitores[$contaId],
                    $saldoPorConta[$contaId],
                    $dia,
                    self::maiorSaidaDoDia($eventos, $indices, $contaId)
                );
            }

            $serieDiaria[] = ['data' => $dia, 'saldo' => $saldo];
        }

        $meses = self::preencherMesesSemEventos($meses, $saldosIniciais);

        return [
            'eventos' => $eventos,
            'meses' => array_values($meses),
            'serie_diaria' => $serieDiaria,
            'contas' => self::resumoPorConta($saldosIniciais, $saldoPorConta, $monitores, $nomesContas),
            'alertas' => self::alertas($monitores, $nomesContas),
            'menor_saldo' => [
                'valor' => $monitores[self::CHAVE_GLOBAL]['menor'],
                'data' => $monitores[self::CHAVE_GLOBAL]['data_menor'],
            ],
            'saldo_final' => $saldo,
        ];
    }

    // -=-=-=- MESES -=-=-=-

    /** @return array<string, array> */
    private static function mesesVazios(Carbon $hoje, Carbon $fim): array
    {
        $meses = [];
        $cursor = $hoje->copy()->startOfMonth();
        $limite = $fim->copy()->startOfMonth();

        while ($cursor->lte($limite)) {
            $chave = $cursor->format('Y-m');
            $meses[$chave] = self::mesVazio($chave);
            $cursor->addMonthNoOverflow();
        }

        return $meses;
    }

    private static function mesVazio(string $chave): array
    {
        return [
            'mes' => $chave,
            'saldo_inicial' => null,
            'entradas' => 0.0,
            'saidas' => 0.0,
            'entradas_estimadas' => 0.0,
            'saidas_estimadas' => 0.0,
            'resultado' => 0.0,
            'saldo_final' => null,
            'saldo_minimo' => null,
            'data_saldo_minimo' => null,
            'quantidade' => 0,
            'sem_valor' => 0,
            'incerteza' => 0.0,
        ];
    }

    /**
     * Meses sem evento nenhum não passaram pelo laço: herdam o saldo do mês anterior
     * (ou o saldo atual, se for o primeiro) — a linha do gráfico fica contínua.
     *
     * @param  array<string, array>  $meses
     * @param  array<int, float>  $saldosIniciais
     * @return array<string, array>
     */
    private static function preencherMesesSemEventos(array $meses, array $saldosIniciais): array
    {
        ksort($meses);

        $saldo = round(array_sum($saldosIniciais), 2);
        $incerteza = 0.0;

        foreach ($meses as &$mes) {
            if ($mes['saldo_inicial'] === null) {
                $mes['saldo_inicial'] = $saldo;
                $mes['saldo_final'] = $saldo;
                $mes['saldo_minimo'] = $saldo;
                $mes['incerteza'] = $incerteza;
            }

            $saldo = $mes['saldo_final'];
            $incerteza = $mes['incerteza'];
            $mes['resultado'] = round($mes['entradas'] - $mes['saidas'], 2);
            $mes['entradas_estimadas'] = round($mes['entradas_estimadas'], 2);
            $mes['saidas_estimadas'] = round($mes['saidas_estimadas'], 2);
        }
        unset($mes);

        return $meses;
    }

    // -=-=-=- MONITORES DE SALDO NEGATIVO -=-=-=-

    private static function novoMonitor(float $saldo, string $dia): array
    {
        $monitor = [
            'menor' => $saldo,
            'data_menor' => $dia,
            'negativo_desde' => null,
            'saldo_negativo' => null,
            'evento' => null,
            'volta_em' => null,
        ];

        self::atualizarMonitor($monitor, $saldo, $dia, null);

        return $monitor;
    }

    private static function atualizarMonitor(array &$monitor, float $saldo, string $dia, ?array $maiorSaida): void
    {
        if ($saldo < $monitor['menor']) {
            $monitor['menor'] = $saldo;
            $monitor['data_menor'] = $dia;
        }

        if ($saldo < 0 && $monitor['negativo_desde'] === null) {
            $monitor['negativo_desde'] = $dia;
            $monitor['saldo_negativo'] = $saldo;
            $monitor['evento'] = $maiorSaida;
        } elseif ($saldo >= 0 && $monitor['negativo_desde'] !== null && $monitor['volta_em'] === null) {
            $monitor['volta_em'] = $dia;
        }
    }

    /** Maior saída (com valor) do dia — o "culpado" mais provável de o saldo ter ficado negativo. */
    private static function maiorSaidaDoDia(array $eventos, array $indices, ?int $contaId): ?array
    {
        $maior = null;

        foreach ($indices as $indice) {
            $evento = $eventos[$indice];

            if ($evento['tipo'] !== 'EXPENSE' || ($evento['valor'] ?? 0) <= 0) {
                continue;
            }

            if ($contaId !== null && $evento['conta_id'] !== $contaId) {
                continue;
            }

            if ($maior === null || $evento['valor'] > $maior['valor']) {
                $maior = ['descricao' => $evento['descricao'], 'valor' => $evento['valor']];
            }
        }

        return $maior;
    }

    /**
     * Um alerta para o saldo total e um por conta que fique negativa — ter dinheiro em outra
     * conta não paga o débito da conta que ficou sem saldo.
     */
    private static function alertas(array $monitores, array $nomesContas): array
    {
        $alertas = [];

        foreach ($monitores as $chave => $monitor) {
            if ($monitor['negativo_desde'] === null) {
                continue;
            }

            $global = $chave === self::CHAVE_GLOBAL;

            $alertas[] = [
                'conta_id' => $global ? null : $chave,
                'conta' => $global ? 'Saldo total' : ($nomesContas[$chave] ?? 'Conta'),
                'data' => $monitor['negativo_desde'],
                'saldo' => $monitor['saldo_negativo'],
                'menor_saldo' => $monitor['menor'],
                'data_menor_saldo' => $monitor['data_menor'],
                'volta_ao_positivo_em' => $monitor['volta_em'],
                'evento' => $monitor['evento'],
            ];
        }

        // Saldo total primeiro (é o mais grave), depois as contas pela data em que estouram.
        usort($alertas, fn (array $a, array $b) => [$a['conta_id'] !== null, $a['data']] <=> [$b['conta_id'] !== null, $b['data']]);

        return $alertas;
    }

    private static function resumoPorConta(array $saldosIniciais, array $saldoPorConta, array $monitores, array $nomesContas): array
    {
        $contas = [];

        foreach ($saldoPorConta as $contaId => $saldoFinal) {
            $monitor = $monitores[$contaId];

            $contas[] = [
                'conta_id' => $contaId,
                'conta' => $nomesContas[$contaId] ?? 'Conta',
                'saldo_inicial' => $saldosIniciais[$contaId] ?? 0.0,
                'saldo_final' => $saldoFinal,
                'menor_saldo' => $monitor['menor'],
                'data_menor_saldo' => $monitor['data_menor'],
                'fica_negativa' => $monitor['negativo_desde'] !== null,
            ];
        }

        return $contas;
    }
}
