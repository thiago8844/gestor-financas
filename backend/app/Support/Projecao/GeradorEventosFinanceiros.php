<?php

namespace App\Support\Projecao;

use App\Actions\Faturas\ResolverFaturaCompra;
use App\Enums\TransactionStatus;
use App\Models\Cartao;
use App\Models\Conta;
use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use App\Support\Recorrencia\CalculadoraProximaOcorrencia;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Motor de projeção: transforma tudo que ainda vai movimentar as contas numa lista de eventos
 * financeiros, independente da interface (relatório, dashboard, alertas...).
 *
 * Fontes de eventos:
 *  - lançamentos PENDENTES já cadastrados (avulsos, parcelas e ocorrências de recorrência);
 *  - ocorrências FUTURAS de recorrências ativas, que o sistema só materializa no dia;
 *  - compras no cartão, que não saem do caixa por si só: viram um único evento "Fatura", no
 *    vencimento, e as compras/parcelas ficam como itens de composição (nunca somadas duas vezes).
 *
 * O que NÃO entra: lançamentos PAGOS (o saldo atual das contas já os reflete) e saldo inicial.
 */
class GeradorEventosFinanceiros
{
    /** Trava de segurança contra uma recorrência diária projetada por anos. */
    private const MAX_OCORRENCIAS_POR_RECORRENCIA = 1500;

    /** @var array<int, array{valor: float, desvio: float, amostras: int, confianca: string}|null> */
    private array $estimativas = [];

    /** @var array<string, array> faturas (reais ou virtuais) com seus itens, por "cartao:Y-m" */
    private array $faturas = [];

    /** @var array<int, array> */
    private array $eventos = [];

    private const RANK_CONFIANCA = ['BAIXA' => 0, 'MEDIA' => 1, 'ALTA' => 2];

    public function __construct(private readonly FiltrosProjecao $filtros)
    {
    }

    /**
     * @return array{
     *     eventos: array<int, array>,
     *     saldos_iniciais: array<int, float>,
     *     contas: array<int, string>
     * }
     */
    public function gerar(): array
    {
        $contas = Conta::where('user_id', $this->filtros->userId)->pluck('name', 'id')->all();
        $contaIds = $this->filtros->contaIds ?: array_keys($contas);

        $pendentes = $this->buscarPendentes($contaIds);
        $recorrencias = $this->buscarRecorrenciasAtivas($contaIds);

        if ($this->filtros->estimarVariaveis) {
            $this->carregarEstimativas($this->recorrenciasSemValor($pendentes, $recorrencias));
        }

        foreach ($pendentes as $transacao) {
            $this->registrarPendente($transacao);
        }

        foreach ($recorrencias as $recorrencia) {
            $this->projetarRecorrencia($recorrencia);
        }

        foreach ($this->faturas as $fatura) {
            $evento = $this->eventoDaFatura($fatura);

            if ($evento !== null) {
                $this->eventos[] = $evento;
            }
        }

        return [
            'eventos' => $this->eventos,
            'saldos_iniciais' => $this->saldosIniciais($contaIds),
            'contas' => $contas,
        ];
    }

    // -=-=-=- FONTES -=-=-=-

    /** @return Collection<int, Transacao> */
    private function buscarPendentes(array $contaIds): Collection
    {
        $fim = $this->filtros->dataFinal->toDateString();

        return Transacao::query()
            ->where('user_id', $this->filtros->userId)
            ->where('status', TransactionStatus::PENDING)
            ->where('is_initial_balance', false)
            ->whereIn('account_id', $contaIds)
            // Compra no cartão: quem manda é o vencimento da fatura (filtrado depois, em memória).
            ->where(function ($q) use ($fim) {
                $q->whereNotNull('card_id')
                    ->orWhereNull('due_date')
                    ->orWhereDate('due_date', '<=', $fim);
            })
            ->with(['categoria:id,name', 'fatura.cartao'])
            ->get();
    }

    /** @return Collection<int, RecorrenciaTransacao> */
    private function buscarRecorrenciasAtivas(array $contaIds): Collection
    {
        return RecorrenciaTransacao::query()
            ->where('user_id', $this->filtros->userId)
            ->where('active', true)
            ->whereIn('account_id', $contaIds)
            ->with(['categoria:id,name', 'cartao'])
            ->get();
    }

    /** @return array<int, float> */
    private function saldosIniciais(array $contaIds): array
    {
        $linhas = DB::table('transactions')
            ->where('user_id', $this->filtros->userId)
            ->where('status', TransactionStatus::PAID->value)
            ->whereIn('account_id', $contaIds)
            ->selectRaw("account_id, SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END) AS saldo")
            ->groupBy('account_id')
            ->pluck('saldo', 'account_id');

        $saldos = [];
        foreach ($contaIds as $id) {
            $saldos[$id] = round((float) ($linhas[$id] ?? 0), 2);
        }

        return $saldos;
    }

    // -=-=-=- PENDENTES JÁ CADASTRADOS -=-=-=-

    private function registrarPendente(Transacao $transacao): void
    {
        $valor = $this->resolverValor(
            $transacao->amount !== null ? (float) $transacao->amount : null,
            $transacao->recurring_transaction_id
        );

        // Compra no cartão com fatura: vira item da fatura, não evento próprio.
        if ($transacao->card_id && $transacao->fatura) {
            $this->adicionarItemNaFatura(
                $transacao->fatura->cartao,
                $transacao->fatura->reference_month,
                [
                    'fatura_id' => $transacao->fatura->id,
                    'fechamento' => $transacao->fatura->closing_date,
                    'vencimento' => $transacao->fatura->due_date,
                ],
                [
                    'transacao_id' => $transacao->id,
                    'descricao' => $transacao->description ?: 'Sem descrição',
                    'categoria' => $transacao->categoria?->name,
                    'data_compra' => $transacao->purchase_date?->toDateString(),
                    'parcela' => $this->rotuloParcela($transacao),
                    'recorrente' => $transacao->recurring_transaction_id !== null,
                    'projetado' => false,
                    ...$valor,
                ]
            );

            return;
        }

        $dataOriginal = Carbon::parse($transacao->due_date ?? $transacao->date ?? $transacao->created_at)->startOfDay();

        $this->eventos[] = $this->montarEvento(
            id: "transacao:{$transacao->id}",
            dataOriginal: $dataOriginal,
            tipo: $transacao->type->value,
            origem: $transacao->isParcelada() ? 'PARCELA' : ($transacao->recurring_transaction_id ? 'RECORRENTE' : 'LANCAMENTO'),
            descricao: $transacao->description ?: 'Sem descrição',
            contaId: $transacao->account_id,
            categoria: $transacao->categoria?->name,
            parcela: $this->rotuloParcela($transacao),
            recorrenciaId: $transacao->recurring_transaction_id,
            projetado: false,
            valor: $valor,
        );
    }

    // -=-=-=- RECORRÊNCIAS FUTURAS -=-=-=-

    private function projetarRecorrencia(RecorrenciaTransacao $recorrencia): void
    {
        $calculadora = new CalculadoraProximaOcorrencia();
        $fim = $this->filtros->dataFinal;
        $data = $recorrencia->next_run_date?->copy()->startOfDay();
        $valor = $this->resolverValor(
            $recorrencia->amount !== null ? (float) $recorrencia->amount : null,
            $recorrencia->id
        );

        try {
            for ($i = 0; $data && $data->lte($fim) && $i < self::MAX_OCORRENCIAS_POR_RECORRENCIA; $i++) {
                if ($recorrencia->end_date && $data->gt($recorrencia->end_date)) {
                    break;
                }

                $this->registrarOcorrencia($recorrencia, $data->copy(), $valor);

                $data = $calculadora->proximaAPartirDe($recorrencia, $data);
            }
        } catch (RuntimeException) {
            // Recorrência mal configurada (ex.: semanal sem dias): não derruba o relatório inteiro.
        }
    }

    private function registrarOcorrencia(RecorrenciaTransacao $recorrencia, Carbon $data, array $valor): void
    {
        if ($recorrencia->card_id && $recorrencia->cartao) {
            // Mesma regra de uma compra real: o fechamento do cartão decide em qual fatura cai.
            $ciclo = ResolverFaturaCompra::referenciaParaCompra($recorrencia->cartao, $data);
            [$fechamento, $vencimento] = ResolverFaturaCompra::calcularDatas($recorrencia->cartao, $ciclo);

            $this->adicionarItemNaFatura(
                $recorrencia->cartao,
                $vencimento->copy()->startOfMonth(),
                ['fatura_id' => null, 'fechamento' => $fechamento, 'vencimento' => $vencimento],
                [
                    'transacao_id' => null,
                    'descricao' => $recorrencia->description,
                    'categoria' => $recorrencia->categoria?->name,
                    'data_compra' => $data->toDateString(),
                    'parcela' => null,
                    'recorrente' => true,
                    'projetado' => true,
                    ...$valor,
                ]
            );

            return;
        }

        $this->eventos[] = $this->montarEvento(
            id: "recorrencia:{$recorrencia->id}:{$data->toDateString()}",
            dataOriginal: $data,
            tipo: $recorrencia->type->value,
            origem: 'RECORRENTE',
            descricao: $recorrencia->description,
            contaId: $recorrencia->account_id,
            categoria: $recorrencia->categoria?->name,
            parcela: null,
            recorrenciaId: $recorrencia->id,
            projetado: true,
            valor: $valor,
        );
    }

    // -=-=-=- FATURAS DE CARTÃO -=-=-=-

    /**
     * Agrupa itens por (cartão, mês de referência). Faturas reais e as "virtuais" (ainda sem
     * nenhuma compra, só com ocorrências de recorrência projetadas) caem na mesma chave —
     * então uma recorrência futura soma na fatura que já existe, sem duplicá-la.
     */
    private function adicionarItemNaFatura(Cartao $cartao, Carbon $referencia, array $datas, array $item): void
    {
        $chave = $cartao->id . ':' . $referencia->format('Y-m');

        $this->faturas[$chave] ??= [
            'fatura_id' => $datas['fatura_id'],
            'cartao_id' => $cartao->id,
            'cartao' => $cartao->name,
            'conta_id' => $cartao->account_id,
            'referencia' => $referencia->format('Y-m'),
            'fechamento' => Carbon::parse($datas['fechamento'])->startOfDay(),
            'vencimento' => Carbon::parse($datas['vencimento'])->startOfDay(),
            'itens' => [],
        ];

        // Se a fatura real aparece depois de uma virtual na mesma chave, ela vence (tem id e datas oficiais).
        if ($datas['fatura_id'] !== null && $this->faturas[$chave]['fatura_id'] === null) {
            $this->faturas[$chave]['fatura_id'] = $datas['fatura_id'];
            $this->faturas[$chave]['fechamento'] = Carbon::parse($datas['fechamento'])->startOfDay();
            $this->faturas[$chave]['vencimento'] = Carbon::parse($datas['vencimento'])->startOfDay();
        }

        $this->faturas[$chave]['itens'][] = $item;
    }

    private function eventoDaFatura(array $fatura): ?array
    {
        if ($fatura['vencimento']->gt($this->filtros->dataFinal)) {
            return null;
        }

        $itens = collect($fatura['itens']);
        $comValor = $itens->filter(fn (array $item) => $item['valor'] !== null);
        $estimados = $itens->where('estimado', true);

        $evento = $this->montarEvento(
            id: "fatura:{$fatura['cartao_id']}:{$fatura['referencia']}",
            dataOriginal: $fatura['vencimento'],
            tipo: 'EXPENSE',
            origem: 'FATURA',
            descricao: "Fatura {$fatura['cartao']}",
            contaId: $fatura['conta_id'],
            categoria: null,
            parcela: null,
            recorrenciaId: null,
            projetado: $fatura['fatura_id'] === null,
            valor: [
                'valor' => $comValor->isEmpty() ? null : round((float) $comValor->sum('valor'), 2),
                'estimado' => $estimados->isNotEmpty(),
                'desvio' => $estimados->isEmpty() ? null : round(sqrt($estimados->sum(fn ($i) => ($i['desvio'] ?? 0) ** 2)), 2),
                'confianca' => $this->piorConfianca($estimados),
            ],
        );

        $evento['itens_sem_valor'] = $itens->filter(fn ($i) => $i['valor'] === null)->count();
        $evento['fatura'] = [
            'id' => $fatura['fatura_id'],
            'cartao_id' => $fatura['cartao_id'],
            'cartao' => $fatura['cartao'],
            'referencia' => $fatura['referencia'],
            'fechamento' => $fatura['fechamento']->toDateString(),
            'vencimento' => $fatura['vencimento']->toDateString(),
        ];
        $evento['itens'] = $itens
            ->sortBy([['data_compra', 'asc'], ['descricao', 'asc']])
            ->values()
            ->all();

        return $evento;
    }

    private function piorConfianca(Collection $estimados): ?string
    {
        if ($estimados->isEmpty()) {
            return null;
        }

        return $estimados
            ->pluck('confianca')
            ->sortBy(fn (string $c) => self::RANK_CONFIANCA[$c] ?? 0)
            ->first();
    }

    // -=-=-=- VALORES VARIÁVEIS -=-=-=-

    /**
     * @param  Collection<int, Transacao>  $pendentes
     * @param  Collection<int, RecorrenciaTransacao>  $recorrencias
     * @return int[]
     */
    private function recorrenciasSemValor(Collection $pendentes, Collection $recorrencias): array
    {
        return $pendentes
            ->filter(fn (Transacao $t) => $t->amount === null && $t->recurring_transaction_id !== null)
            ->pluck('recurring_transaction_id')
            ->merge($recorrencias->filter(fn ($r) => $r->amount === null)->pluck('id'))
            ->unique()
            ->values()
            ->all();
    }

    /**
     * Uma consulta só para o histórico de todas as recorrências variáveis; o estimador usa
     * apenas as últimas ocorrências de cada uma.
     *
     * @param  int[]  $recorrenciaIds
     */
    private function carregarEstimativas(array $recorrenciaIds): void
    {
        if ($recorrenciaIds === []) {
            return;
        }

        $historico = DB::table('transactions')
            ->where('user_id', $this->filtros->userId)
            ->whereIn('recurring_transaction_id', $recorrenciaIds)
            ->whereNotNull('amount')
            ->orderByRaw('COALESCE(date, due_date, purchase_date, created_at) DESC')
            ->get(['recurring_transaction_id', 'amount'])
            ->groupBy('recurring_transaction_id');

        foreach ($recorrenciaIds as $id) {
            $valores = ($historico[$id] ?? collect())
                ->take(EstimadorValorVariavel::MAX_AMOSTRAS)
                ->pluck('amount')
                ->all();

            $this->estimativas[$id] = EstimadorValorVariavel::estimar($valores);
        }
    }

    /**
     * @return array{valor: ?float, estimado: bool, desvio: ?float, confianca: ?string}
     */
    private function resolverValor(?float $valorFixo, ?int $recorrenciaId): array
    {
        if ($valorFixo !== null) {
            return ['valor' => $valorFixo, 'estimado' => false, 'desvio' => null, 'confianca' => null];
        }

        $estimativa = $recorrenciaId !== null ? ($this->estimativas[$recorrenciaId] ?? null) : null;

        if ($estimativa === null) {
            return ['valor' => null, 'estimado' => false, 'desvio' => null, 'confianca' => null];
        }

        return [
            'valor' => $estimativa['valor'],
            'estimado' => true,
            'desvio' => $estimativa['desvio'],
            'confianca' => $estimativa['confianca'],
        ];
    }

    // -=-=-=- MONTAGEM -=-=-=-

    private function montarEvento(
        string $id,
        Carbon $dataOriginal,
        string $tipo,
        string $origem,
        string $descricao,
        int $contaId,
        ?string $categoria,
        ?string $parcela,
        ?int $recorrenciaId,
        bool $projetado,
        array $valor,
    ): array {
        // Vencido e ainda pendente continua sendo compromisso: pesa no saldo a partir de hoje.
        $atrasado = $dataOriginal->lt($this->filtros->hoje);
        $dataEfetiva = $atrasado ? $this->filtros->hoje : $dataOriginal;

        return [
            'id' => $id,
            'data' => $dataEfetiva->toDateString(),
            'data_original' => $dataOriginal->toDateString(),
            'atrasado' => $atrasado,
            'tipo' => $tipo,
            'origem' => $origem,
            'descricao' => $descricao,
            'valor' => $valor['valor'],
            'estimado' => $valor['estimado'],
            'desvio' => $valor['desvio'],
            'confianca' => $valor['confianca'],
            'sem_valor' => $valor['valor'] === null,
            'projetado' => $projetado,
            'conta_id' => $contaId,
            'categoria' => $categoria,
            'parcela' => $parcela,
            'recorrencia_id' => $recorrenciaId,
            'fatura' => null,
            'itens' => [],
            'itens_sem_valor' => $valor['valor'] === null ? 1 : 0,
        ];
    }

    private function rotuloParcela(Transacao $transacao): ?string
    {
        return $transacao->isParcelada()
            ? "{$transacao->installment_number}/{$transacao->installment_total}"
            : null;
    }
}
