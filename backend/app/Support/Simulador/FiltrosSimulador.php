<?php

namespace App\Support\Simulador;

use App\Support\Projecao\FiltrosProjecao;
use Carbon\Carbon;

/**
 * Parâmetros do Simulador Financeiro, já normalizados a partir do array validado da Request.
 * Como nos Compromissos Futuros, a projeção sempre parte de hoje: o passado está no saldo atual.
 */
final class FiltrosSimulador
{
    public function __construct(
        public readonly int $userId,
        public readonly Carbon $hoje,
        public readonly Carbon $dataFinal,
        /** @var int[] Vazio = todas as contas do usuário. */
        public readonly array $contaIds = [],
        /** @var int[] Vazio = todos os cartões das contas selecionadas. */
        public readonly array $cartaoIds = [],
        /** Meses completos de histórico a analisar; null = automático (até 24, conforme houver dados). */
        public readonly ?int $mesesHistorico = null,
        /** Chave mestra: mesma opção do relatório de Compromissos Futuros. */
        public readonly bool $estimarVariaveis = true,
        public readonly bool $preverDespesasVariaveis = true,
        public readonly bool $preverReceitasVariaveis = true,
    ) {
    }

    public const MAX_MESES_HISTORICO = 24;

    /** Mudou a regra de cálculo? Incrementar: o cache antigo deixa de ser usado no deploy. */
    private const VERSAO_ALGORITMO = 4;

    public static function fromArray(int $userId, array $dados, ?Carbon $hoje = null): self
    {
        $bool = fn (string $campo, bool $padrao) => array_key_exists($campo, $dados) && $dados[$campo] !== null
            ? filter_var($dados[$campo], FILTER_VALIDATE_BOOLEAN)
            : $padrao;

        return new self(
            userId: $userId,
            hoje: ($hoje ?? Carbon::today())->copy()->startOfDay(),
            dataFinal: Carbon::parse($dados['data_final'])->startOfDay(),
            contaIds: array_map('intval', $dados['conta_ids'] ?? []),
            cartaoIds: array_map('intval', $dados['cartao_ids'] ?? []),
            mesesHistorico: isset($dados['meses_historico']) ? (int) $dados['meses_historico'] : null,
            estimarVariaveis: $bool('estimar_variaveis', true),
            preverDespesasVariaveis: $bool('prever_despesas_variaveis', true),
            preverReceitasVariaveis: $bool('prever_receitas_variaveis', true),
        );
    }

    /** Filtros do motor de projeção compartilhado com Compromissos Futuros. */
    public function filtrosProjecao(): FiltrosProjecao
    {
        return new FiltrosProjecao(
            userId: $this->userId,
            hoje: $this->hoje,
            dataFinal: $this->dataFinal,
            contaIds: $this->contaIds,
            estimarVariaveis: $this->estimarVariaveis,
        );
    }

    public function preverDespesas(): bool
    {
        return $this->estimarVariaveis && $this->preverDespesasVariaveis;
    }

    public function preverReceitas(): bool
    {
        return $this->estimarVariaveis && $this->preverReceitasVariaveis;
    }

    public function mesAtual(): Carbon
    {
        return $this->hoje->copy()->startOfMonth();
    }

    /** @return string[] meses 'Y-m' do mês atual até o mês da data final */
    public function mesesProjetados(): array
    {
        $meses = [];
        for ($mes = $this->mesAtual(); $mes->lte($this->dataFinal); $mes = $mes->copy()->addMonthNoOverflow()) {
            $meses[] = $mes->format('Y-m');
        }

        return $meses;
    }

    public function chaveCache(string $versaoDados): string
    {
        return 'simulador:v' . self::VERSAO_ALGORITMO . ':' . $this->userId . ':' . md5(json_encode([
            $this->hoje->toDateString(), $this->dataFinal->toDateString(), $this->contaIds, $this->cartaoIds,
            $this->mesesHistorico, $this->estimarVariaveis, $this->preverDespesasVariaveis,
            $this->preverReceitasVariaveis, $versaoDados,
        ]));
    }
}
