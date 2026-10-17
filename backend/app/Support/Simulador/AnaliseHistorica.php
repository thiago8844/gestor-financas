<?php

namespace App\Support\Simulador;

use App\Enums\TransactionStatus;
use App\Models\Cartao;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Camada de leitura + estatística: lê o histórico das contas selecionadas e monta, por categoria
 * (separando receita de despesa), a série mensal, o padrão de dias, os meios de pagamento e o
 * modelo de previsão.
 *
 * A série de cada categoria é o TOTAL da categoria — inclusive o que veio de recorrências e o que foi
 * lançado à mão. A reconciliação depois desconta TUDO que já está previsto no mês (lançado, agendado
 * e ocorrências futuras de recorrências). Assim não há duplicação mesmo quando o salário foi digitado
 * à mão por meses e só depois virou recorrência (sem vínculo com os lançamentos antigos).
 *
 * Ficam de fora:
 *  - compras parceladas (as parcelas futuras já são compromissos conhecidos, e uma TV em 10x não
 *    significa que você compra uma TV todo mês);
 *  - transferências e saldo inicial (não são renda nem consumo — o saldo inicial é o acúmulo de um
 *    passado que não está no sistema e nunca é tratado como receita).
 *
 * O mês de cada lançamento é o do CONSUMO: data da compra no cartão (não o vencimento da fatura),
 * data do lançamento nas contas. É o que permite prever QUANDO a compra acontece e, a partir
 * disso, em qual fatura ela cai.
 */
final class AnaliseHistorica
{
    /** Janela usada para descobrir o meio de pagamento habitual de cada categoria. */
    private const MESES_CANAIS = 6;

    /** Lançamento extraordinário: acima de N× o 3º quartil dos lançamentos do tipo... */
    private const FATOR_EXTRAORDINARIO = 4.0;
    /** ...e maior que um mês típico inteiro daquele tipo. Exige um mínimo de histórico para julgar. */
    private const MIN_LANCAMENTOS_EXTRAORDINARIO = 6;
    private const MIN_MESES_EXTRAORDINARIO = 3;
    /** Em quantos meses um valor alto precisa aparecer na categoria para deixar de ser exceção. */
    private const MESES_PARA_SER_PADRAO = 3;

    public function __construct(private readonly FiltrosSimulador $filtros)
    {
    }

    /**
     * @param  int[]  $contaIds  contas efetivamente consideradas
     * @param  float  $saldoAtual  soma dos saldos atuais dessas contas
     * @param  array<int, array{tipo: string, categoria_id: ?int, data: string, valor: float}>  $recorrenciasProjetadas
     *         ocorrências futuras de recorrências (ainda não materializadas), já projetadas pelo motor
     */
    public function analisar(array $contaIds, float $saldoAtual, array $recorrenciasProjetadas = []): array
    {
        $cartoes = Cartao::where('user_id', $this->filtros->userId)
            ->whereIn('account_id', $contaIds)
            ->get(['id', 'name', 'account_id', 'closing_day', 'due_day', 'active'])
            ->keyBy('id');

        $linhas = $this->buscarLancamentos($contaIds);
        [$inicio, $mesesHistorico] = $this->janelaHistorico($linhas);
        $linhas = $this->marcarExtraordinarios($linhas, $mesesHistorico);

        return [
            'inicio' => $inicio?->format('Y-m'),
            'meses' => $mesesHistorico,
            'categorias' => $this->modelosPorCategoria($linhas, $mesesHistorico, $cartoes->all(), $recorrenciasProjetadas),
            'mensal' => $this->historicoMensal($contaIds, $mesesHistorico, $saldoAtual),
            'cartoes' => $cartoes->map(fn (Cartao $c) => [
                'id' => $c->id,
                'nome' => $c->name,
                'conta_id' => $c->account_id,
                'fechamento' => $c->closing_day,
                'vencimento' => $c->due_day,
                'ativo' => (bool) $c->active,
            ])->values()->all(),
        ];
    }

    // -=-=-=- LEITURA -=-=-=-

    /**
     * Lançamentos (pagos e pendentes) do início possível do histórico até o fim da projeção.
     * Saldo inicial nunca entra (é o acúmulo de um passado que não está no sistema).
     * Os do mês atual em diante não vão para a série: são o "já cadastrado" que a estimativa
     * precisa descontar.
     */
    private function buscarLancamentos(array $contaIds): array
    {
        $inicioMaximo = $this->filtros->mesAtual()->subMonthsNoOverflow(FiltrosSimulador::MAX_MESES_HISTORICO);
        $dataConsumo = 'COALESCE(t.purchase_date, t.date, t.due_date, t.created_at)';

        return DB::table('transactions as t')
            ->leftJoin('categories as c', 'c.id', '=', 't.category_id')
            ->where('t.user_id', $this->filtros->userId)
            ->whereIn('t.account_id', $contaIds)
            ->where('t.is_initial_balance', false)
            ->whereNotNull('t.amount')
            // Rolagem de pagamento parcial de fatura não é consumo nem renda (e nem data histórico).
            ->where(fn ($q) => $q->whereNull('t.transfer_id')->orWhereNull('t.card_id'))
            ->when($this->filtros->cartaoIds, fn ($q) => $q->where(fn ($w) => $w
                ->whereNull('t.card_id')
                ->orWhereIn('t.card_id', $this->filtros->cartaoIds)))
            ->whereRaw("{$dataConsumo} >= ?", [$inicioMaximo->toDateString()])
            ->whereRaw("{$dataConsumo} <= ?", [$this->filtros->dataFinal->toDateString() . ' 23:59:59'])
            ->get([
                't.type', 't.amount', 't.category_id', 'c.name as categoria', 't.account_id', 't.card_id',
                't.recurring_transaction_id', 't.installment_total', 't.transfer_id', 't.purchase_date', 't.date', 't.due_date', 't.created_at',
                't.description',
            ])
            ->map(function ($linha) {
                $data = substr((string) ($linha->purchase_date ?? $linha->date ?? $linha->due_date ?? $linha->created_at), 0, 10);

                return [
                    'tipo' => $linha->type,
                    'valor' => round((float) $linha->amount, 2),
                    'categoria_id' => $linha->category_id !== null ? (int) $linha->category_id : null,
                    'categoria' => $linha->categoria ?? 'Sem categoria',
                    'conta_id' => (int) $linha->account_id,
                    'cartao_id' => $linha->card_id !== null ? (int) $linha->card_id : null,
                    'data' => $data,
                    'mes' => substr($data, 0, 7),
                    'dia' => (int) substr($data, 8, 2),
                    'descricao' => $linha->description ?: 'Sem descrição',
                    'extraordinario' => false,
                    // Transferência só serve para datar o início do histórico: não é consumo nem renda.
                    'variavel' => $linha->transfer_id === null && (int) $linha->installment_total <= 1,
                    'recorrente' => $linha->recurring_transaction_id !== null,
                ];
            })
            ->all();
    }

    /**
     * Meses completos analisados: no máximo os N escolhidos (ou 24 no automático), e nunca antes
     * do primeiro lançamento do usuário. O primeiro mês só conta se começou "cheio" (até o dia 7):
     * quem começou a usar o sistema no dia 20 tem um primeiro mês artificialmente baixo.
     *
     * @return array{0: ?Carbon, 1: string[]}
     */
    private function janelaHistorico(array $linhas): array
    {
        $mesAtual = $this->filtros->mesAtual();
        $limite = min($this->filtros->mesesHistorico ?? FiltrosSimulador::MAX_MESES_HISTORICO, FiltrosSimulador::MAX_MESES_HISTORICO);
        $inicio = $mesAtual->copy()->subMonthsNoOverflow($limite);

        $passadas = array_filter($linhas, fn (array $l) => $l['mes'] < $mesAtual->format('Y-m'));
        if ($passadas === []) {
            return [null, []];
        }

        $primeiraData = min(array_column($passadas, 'data'));
        $primeiroMes = Carbon::parse($primeiraData)->startOfMonth();

        if ($primeiroMes->gt($inicio)) {
            $inicio = $primeiroMes;
            $mesesDisponiveis = $inicio->diffInMonths($mesAtual);

            if ((int) substr($primeiraData, 8, 2) > 7 && $mesesDisponiveis > 3) {
                $inicio = $inicio->copy()->addMonthNoOverflow();
            }
        }

        $meses = [];
        for ($mes = $inicio->copy(); $mes->lt($mesAtual); $mes = $mes->copy()->addMonthNoOverflow()) {
            $meses[] = $mes->format('Y-m');
        }

        return [$inicio, $meses];
    }

    /**
     * Herança, venda de um carro, um prêmio, a compra do carro: valores enormes que aparecem uma
     * vez. Se entrassem na série, a previsão passaria a "esperar" uma herança por mês (ou, para
     * despesas, a compra de um carro). São marcados como extraordinários e ficam FORA das séries
     * e da reconciliação — mas continuam no caixa quando são compromissos reais cadastrados,
     * e aparecem na explicação da categoria.
     *
     * Critério, por tipo (receita/despesa), sobre lançamentos não recorrentes e não parcelados:
     * valor > 4× o 3º quartil dos lançamentos do tipo E > o total de um mês típico do tipo
     * (mediana mensal calculada sem os candidatos), e raro na categoria (menos de 3 meses com valores
     * assim). Um salário não é extraordinário (é o próprio mês típico); venda de gado todo mês também
     * não (é a renda do negócio); uma herança de 40 salários é.
     */
    private function marcarExtraordinarios(array $linhas, array $mesesHistorico): array
    {
        if (count($mesesHistorico) < self::MIN_MESES_EXTRAORDINARIO) {
            return $linhas;
        }

        $primeiro = $mesesHistorico[0];
        $mesAtual = $this->filtros->mesAtual()->format('Y-m');

        foreach (['INCOME', 'EXPENSE'] as $tipo) {
            $historicas = array_filter($linhas, fn (array $l) => $l['tipo'] === $tipo && $l['variavel'] && !$l['recorrente']
                && $l['mes'] >= $primeiro && $l['mes'] < $mesAtual);

            if (count($historicas) < self::MIN_LANCAMENTOS_EXTRAORDINARIO) {
                continue;
            }

            $valores = array_column($historicas, 'valor');
            sort($valores);
            $limiteValor = self::FATOR_EXTRAORDINARIO * $valores[(int) floor(0.75 * (count($valores) - 1))];

            // Mês típico do tipo (todos os lançamentos, inclusive recorrentes), sem os candidatos.
            $porMes = array_fill_keys($mesesHistorico, 0.0);
            foreach ($linhas as $l) {
                if ($l['tipo'] === $tipo && isset($porMes[$l['mes']]) && ($l['valor'] <= $limiteValor || !$l['variavel'])) {
                    $porMes[$l['mes']] += $l['valor'];
                }
            }
            $mensais = array_values($porMes);
            sort($mensais);
            $n = count($mensais);
            $mesTipico = $n % 2 ? $mensais[intdiv($n, 2)] : ($mensais[$n / 2 - 1] + $mensais[$n / 2]) / 2;

            $candidato = fn (array $l) => $l['tipo'] === $tipo && $l['variavel'] && !$l['recorrente'] && $l['mes'] >= $primeiro
                && $l['valor'] > $limiteValor && $l['valor'] > $mesTipico;

            // Valor alto que se repete na mesma categoria (venda de gado todo mês, bônus de todo
            // semestre) é padrão de renda/gasto, não exceção: só é extraordinário o que é raro.
            $mesesPorCategoria = [];
            foreach ($linhas as $l) {
                if ($candidato($l) && $l['mes'] < $mesAtual) {
                    $mesesPorCategoria[$l['categoria_id'] ?? 0][$l['mes']] = true;
                }
            }

            foreach ($linhas as &$l) {
                $repetido = count($mesesPorCategoria[$l['categoria_id'] ?? 0] ?? []) >= self::MESES_PARA_SER_PADRAO;

                if ($candidato($l) && !$repetido) {
                    $l['extraordinario'] = true;
                }
            }
            unset($l);
        }

        return $linhas;
    }

    // -=-=-=- MODELOS POR CATEGORIA -=-=-=-

    /**
     * @param  string[]  $mesesHistorico
     * @param  array<int, Cartao>  $cartoes
     */
    private function modelosPorCategoria(array $linhas, array $mesesHistorico, array $cartoes, array $recorrenciasProjetadas): array
    {
        $mesesProjetados = $this->filtros->mesesProjetados();
        $primeiroHistorico = $mesesHistorico[0] ?? null;
        $mesAtual = $this->filtros->mesAtual()->format('Y-m');
        $grupos = [];
        $extraordinarios = [];
        $extraNoMes = [];

        foreach ($linhas as $linha) {
            if (!$linha['variavel']) {
                continue;
            }

            $chave = $linha['tipo'] . ':' . ($linha['categoria_id'] ?? 0);

            if ($linha['extraordinario']) {
                $extraNoMes[$chave][$linha['mes']] = ($extraNoMes[$chave][$linha['mes']] ?? 0.0) + $linha['valor'];
                $extraordinarios[$chave][] = [
                    'data' => $linha['data'],
                    'descricao' => $linha['descricao'],
                    'valor' => $linha['valor'],
                    'futuro' => $linha['mes'] >= $mesAtual,
                ];
                continue;
            }

            $grupos[$chave] ??= [
                'chave' => $chave,
                'tipo' => $linha['tipo'],
                'categoria_id' => $linha['categoria_id'],
                'categoria' => $linha['categoria'],
                'serie' => array_fill_keys($mesesHistorico, 0.0),
                'conhecido' => array_fill_keys($mesesProjetados, 0.0),
                'recorrente' => array_fill_keys($mesesProjetados, 0.0),
                'ocorrencias' => [],
                'canais' => [],
            ];
            $grupo = &$grupos[$chave];

            if ($linha['mes'] >= $mesAtual) {
                if (isset($grupo['conhecido'][$linha['mes']])) {
                    $grupo['conhecido'][$linha['mes']] = round($grupo['conhecido'][$linha['mes']] + $linha['valor'], 2);
                }
            } elseif ($primeiroHistorico !== null && $linha['mes'] >= $primeiroHistorico) {
                $grupo['serie'][$linha['mes']] = round($grupo['serie'][$linha['mes']] + $linha['valor'], 2);
                $grupo['ocorrencias'][] = [$linha['dia'], $linha['valor']];

                $idade = Carbon::parse($linha['mes'] . '-01')->diffInMonths($this->filtros->mesAtual()) - 1;
                if ($idade < self::MESES_CANAIS) {
                    $canal = $linha['cartao_id'] !== null ? 'cartao:' . $linha['cartao_id'] : 'conta:' . $linha['conta_id'];
                    $grupo['canais'][$canal] = ($grupo['canais'][$canal] ?? 0.0) + $linha['valor'] * 0.5 ** ($idade / 4);
                }
            }
            unset($grupo);
        }

        // Ocorrências futuras de recorrências também são "já previsto" no mês da categoria.
        foreach ($recorrenciasProjetadas as $ocorrencia) {
            $chave = $ocorrencia['tipo'] . ':' . ($ocorrencia['categoria_id'] ?? 0);
            $mes = substr($ocorrencia['data'], 0, 7);

            if (!isset($grupos[$chave]) || !array_key_exists($mes, $grupos[$chave]['recorrente'])) {
                continue;
            }

            $grupos[$chave]['recorrente'][$mes] = round($grupos[$chave]['recorrente'][$mes] + $ocorrencia['valor'], 2);
        }

        $modelos = [];
        foreach ($grupos as $chave => $grupo) {
            // Mês cujo único gasto foi extraordinário não é "mês sem gasto": é mês sem informação
            // sobre a rotina — sai da série em vez de virar zero (que puxaria a frequência para baixo).
            $mesesSerie = array_values(array_filter(
                array_keys($grupo['serie']),
                fn (string $mes) => $grupo['serie'][$mes] > 0 || !isset($extraNoMes[$chave][$mes])
            ));
            $serie = array_map(fn (string $mes) => $grupo['serie'][$mes], $mesesSerie);
            $estimativa = EstimadorSerieMensal::estimar($serie, $grupo['tipo'] === 'INCOME', $mesesSerie);
            $atipicos = array_map(fn (int $i) => $mesesSerie[$i], $estimativa['estatisticas']['atipicos']);

            $modelos[$chave] = [
                'chave' => $chave,
                'tipo' => $grupo['tipo'],
                'categoria_id' => $grupo['categoria_id'],
                'categoria' => $grupo['categoria'],
                'historico' => array_map(
                    fn (string $mes) => [
                        'mes' => $mes,
                        'valor' => $grupo['serie'][$mes],
                        'atipico' => in_array($mes, $atipicos, true),
                        'extraordinario' => round($extraNoMes[$chave][$mes] ?? 0.0, 2),
                    ],
                    array_keys($grupo['serie'])
                ),
                'estimativa' => $estimativa,
                'perfil' => PerfilDistribuicaoMensal::aPartirDe($grupo['ocorrencias']),
                'canais' => $this->normalizarCanais($grupo['canais'], $cartoes, $grupo['tipo']),
                'conhecido' => $grupo['conhecido'],
                'recorrente' => $grupo['recorrente'],
                'extraordinarios' => $extraordinarios[$chave] ?? [],
            ];
        }

        // Categoria que só teve lançamentos extraordinários: aparece (para explicar), sem previsão.
        foreach ($extraordinarios as $chave => $lista) {
            if (isset($modelos[$chave])) {
                continue;
            }

            $linha = collect($linhas)->first(fn ($l) => $l['tipo'] . ':' . ($l['categoria_id'] ?? 0) === $chave);
            $modelos[$chave] = [
                'chave' => $chave,
                'tipo' => $linha['tipo'],
                'categoria_id' => $linha['categoria_id'],
                'categoria' => $linha['categoria'],
                'historico' => array_map(fn ($mes) => ['mes' => $mes, 'valor' => 0.0, 'atipico' => false, 'extraordinario' => round($extraNoMes[$chave][$mes] ?? 0.0, 2)], $mesesHistorico),
                'estimativa' => EstimadorSerieMensal::estimar(array_fill(0, count($mesesHistorico), 0.0), $linha['tipo'] === 'INCOME', $mesesHistorico),
                'perfil' => PerfilDistribuicaoMensal::aPartirDe([]),
                'canais' => [],
                'conhecido' => array_fill_keys($mesesProjetados, 0.0),
                'recorrente' => array_fill_keys($mesesProjetados, 0.0),
                'extraordinarios' => $lista,
            ];
        }

        uasort($modelos, fn ($a, $b) => [$a['tipo'], -($a['estimativa']['valor'] ?? 0), $a['categoria']]
            <=> [$b['tipo'], -($b['estimativa']['valor'] ?? 0), $b['categoria']]);

        return $modelos;
    }

    /**
     * Participação de cada meio de pagamento. Cartão inativo não recebe compras futuras: sua
     * parte é redistribuída entre os demais meios (ou vai para a conta do cartão, se for o único).
     * Receita nunca entra por cartão.
     *
     * @param  array<string, float>  $pesos
     * @param  array<int, Cartao>  $cartoes
     */
    private function normalizarCanais(array $pesos, array $cartoes, string $tipo): array
    {
        $validos = [];
        $orfaos = [];

        foreach ($pesos as $canal => $peso) {
            [$tipoCanal, $id] = explode(':', $canal);
            $id = (int) $id;

            if ($tipoCanal === 'cartao') {
                $cartao = $cartoes[$id] ?? null;

                if ($tipo === 'INCOME' || $cartao === null || !$cartao->active) {
                    $orfaos[$cartao ? 'conta:' . $cartao->account_id : $canal] = ($orfaos[$cartao ? 'conta:' . $cartao->account_id : $canal] ?? 0) + $peso;
                    continue;
                }
            }

            $validos[$canal] = ($validos[$canal] ?? 0.0) + $peso;
        }

        if ($validos === []) {
            $validos = array_filter($orfaos, fn ($peso, $canal) => str_starts_with($canal, 'conta:'), ARRAY_FILTER_USE_BOTH);
        }

        $total = array_sum($validos);
        if ($total <= 0) {
            return [];
        }

        arsort($validos);
        $canais = [];
        foreach ($validos as $canal => $peso) {
            [$tipoCanal, $id] = explode(':', $canal);
            $canais[] = [
                'canal' => $canal,
                'tipo' => $tipoCanal === 'cartao' ? 'CARTAO' : 'CONTA',
                'id' => (int) $id,
                'participacao' => round($peso / $total, 4),
            ];
        }

        return $canais;
    }

    // -=-=-=- HISTÓRICO DE CAIXA -=-=-=-

    /**
     * Receitas e despesas pagas por mês (regime de caixa) e o saldo ao fim de cada mês, calculado
     * para trás a partir do saldo atual. Transferências e saldo inicial não são receita nem despesa,
     * mas continuam no saldo (é dinheiro que de fato estava na conta).
     */
    private function historicoMensal(array $contaIds, array $mesesHistorico, float $saldoAtual): array
    {
        if ($mesesHistorico === []) {
            return [];
        }

        $inicio = $mesesHistorico[0] . '-01';
        $dataCaixa = 'COALESCE(date, created_at)';

        $linhas = DB::table('transactions')
            ->where('user_id', $this->filtros->userId)
            ->whereIn('account_id', $contaIds)
            ->where('status', TransactionStatus::PAID->value)
            ->whereRaw("{$dataCaixa} >= ?", [$inicio])
            ->get(['type', 'amount', 'transfer_id', 'is_initial_balance', 'date', 'created_at']);

        $porMes = [];
        foreach ($linhas as $linha) {
            $mes = substr((string) ($linha->date ?? $linha->created_at), 0, 7);
            $valor = (float) $linha->amount;
            $porMes[$mes] ??= ['receitas' => 0.0, 'despesas' => 0.0, 'liquido' => 0.0];
            $porMes[$mes]['liquido'] += $linha->type === 'INCOME' ? $valor : -$valor;

            if ($linha->transfer_id !== null || $linha->is_initial_balance) {
                continue;
            }

            $porMes[$mes][$linha->type === 'INCOME' ? 'receitas' : 'despesas'] += $valor;
        }

        // Saldo ao fim do mês M = saldo atual − tudo que se movimentou depois de M.
        $resultado = [];
        foreach ($mesesHistorico as $mes) {
            $movimentoPosterior = 0.0;
            foreach ($porMes as $m => $valores) {
                if ($m > $mes) {
                    $movimentoPosterior += $valores['liquido'];
                }
            }

            $resultado[] = [
                'mes' => $mes,
                'receitas' => round($porMes[$mes]['receitas'] ?? 0.0, 2),
                'despesas' => round($porMes[$mes]['despesas'] ?? 0.0, 2),
                'saldo_final' => round($saldoAtual - $movimentoPosterior, 2),
            ];
        }

        return $resultado;
    }
}
