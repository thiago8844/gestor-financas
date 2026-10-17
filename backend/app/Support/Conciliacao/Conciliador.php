<?php

namespace App\Support\Conciliacao;

use App\Support\Conciliacao\Dto\EntradaRazao;
use App\Support\Conciliacao\Dto\LinhaExtrato;
use Carbon\Carbon;

/**
 * Motor de pareamento linha do extrato ↔ entrada do razão. Classe pura (sem banco).
 *
 * Regras:
 *  - só pareia mesmo tipo (saída com saída) e valor exato (ao centavo);
 *  - a data pode variar até a tolerância (o banco às vezes posta no dia útil seguinte);
 *  - a descrição só desempata;
 *  - 1:1 — cada linha e cada entrada entram em no máximo um par (guloso pelo melhor score).
 *
 * Confiança ALTA (aplicada sozinha): data até 2 dias e o par é inequívoco (único candidato dos dois
 * lados) ou a descrição bate. O resto vira sugestão (MEDIA), que o usuário aceita com um clique.
 */
class Conciliador
{
    public const ALTA = 'ALTA';
    public const MEDIA = 'MEDIA';

    public function __construct(private readonly int $toleranciaDias = 4)
    {
    }

    /**
     * @param LinhaExtrato[] $linhas
     * @param EntradaRazao[] $entradas  só as livres (ainda não conciliadas)
     * @return array<int, array{linha_id: int, chave: string, dias: int, similaridade: float, score: float, confianca: string}>
     *         indexado pelo id da linha
     */
    public function parear(array $linhas, array $entradas): array
    {
        $pares = [];
        $candidatosPorLinha = [];
        $candidatosPorEntrada = [];

        foreach ($linhas as $linha) {
            foreach ($entradas as $entrada) {
                if (!$this->compativel($linha, $entrada)) {
                    continue;
                }

                $dias = self::dias($linha->data, $entrada->data);

                if ($dias > $this->toleranciaDias) {
                    continue;
                }

                $similaridade = NormalizadorDescricao::similaridade($linha->descricao, $entrada->descricao);

                $pares[] = [
                    'linha_id' => $linha->id,
                    'chave' => $entrada->chave,
                    'dias' => $dias,
                    'similaridade' => $similaridade,
                    'score' => 100 - 8 * $dias + 20 * $similaridade,
                ];

                $candidatosPorLinha[$linha->id] = ($candidatosPorLinha[$linha->id] ?? 0) + 1;
                $candidatosPorEntrada[$entrada->chave] = ($candidatosPorEntrada[$entrada->chave] ?? 0) + 1;
            }
        }

        // Melhor score primeiro; empate resolvido de forma estável (data mais próxima, depois ids).
        usort($pares, fn (array $a, array $b) => [$b['score'], $a['dias'], $a['linha_id'], $a['chave']]
            <=> [$a['score'], $b['dias'], $b['linha_id'], $b['chave']]);

        $resultado = [];
        $entradasUsadas = [];

        foreach ($pares as $par) {
            if (isset($resultado[$par['linha_id']]) || isset($entradasUsadas[$par['chave']])) {
                continue;
            }

            $inequivoco = $candidatosPorLinha[$par['linha_id']] === 1 && $candidatosPorEntrada[$par['chave']] === 1;
            $descricaoBate = $par['similaridade'] >= 0.5;

            $par['confianca'] = $par['dias'] <= 2 && ($inequivoco || $descricaoBate) ? self::ALTA : self::MEDIA;

            $resultado[$par['linha_id']] = $par;
            $entradasUsadas[$par['chave']] = true;
        }

        return $resultado;
    }

    /**
     * Para o "Vincular a..." manual: entradas do mesmo tipo, perto da data, com o valor exato
     * primeiro e depois os mais próximos (para achar o lançamento lançado com valor errado).
     *
     * @param EntradaRazao[] $entradas
     * @return array<int, array{chave: string, dias: int, diferenca: float, similaridade: float}>
     */
    public function candidatos(LinhaExtrato $linha, array $entradas, int $limite = 6, int $janelaDias = 10): array
    {
        $lista = [];

        foreach ($entradas as $entrada) {
            if (!$this->compativel($linha, $entrada, exigirValor: false)) {
                continue;
            }

            $dias = self::dias($linha->data, $entrada->data);

            if ($dias > $janelaDias) {
                continue;
            }

            $lista[] = [
                'chave' => $entrada->chave,
                'dias' => $dias,
                'diferenca' => round($entrada->valor - $linha->valor, 2),
                'similaridade' => NormalizadorDescricao::similaridade($linha->descricao, $entrada->descricao),
            ];
        }

        usort($lista, fn (array $a, array $b) => [abs($a['diferenca']) >= 0.005, abs($a['diferenca']), -$a['similaridade'], $a['dias'], $a['chave']]
            <=> [abs($b['diferenca']) >= 0.005, abs($b['diferenca']), -$b['similaridade'], $b['dias'], $b['chave']]);

        return array_slice($lista, 0, $limite);
    }

    public static function dias(Carbon $a, Carbon $b): int
    {
        return (int) round(abs($a->copy()->startOfDay()->getTimestamp() - $b->copy()->startOfDay()->getTimestamp()) / 86400);
    }

    private function compativel(LinhaExtrato $linha, EntradaRazao $entrada, bool $exigirValor = true): bool
    {
        if ($linha->tipo !== $entrada->tipo) {
            return false;
        }

        return !$exigirValor || abs($linha->valor - $entrada->valor) < 0.005;
    }
}
