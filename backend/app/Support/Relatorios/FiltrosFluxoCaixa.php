<?php

namespace App\Support\Relatorios;

use App\Enums\RegimeRelatorio;
use Carbon\Carbon;

/**
 * Filtros de um relatório de Fluxo de Caixa, já normalizados a partir do
 * array validado da Request. Mantém a Query livre de saber sobre HTTP.
 */
final class FiltrosFluxoCaixa
{
    public function __construct(
        public readonly int $userId,
        public readonly Carbon $dataInicial,
        public readonly Carbon $dataFinal,
        public readonly RegimeRelatorio $regime,
        public readonly ?int $contaId = null,
        public readonly ?int $categoriaId = null,
        public readonly ?int $orcamentoId = null,
        public readonly ?string $tipo = null,
        public readonly ?string $status = null,
        public readonly ?float $valorMinimo = null,
        public readonly ?float $valorMaximo = null,
        public readonly ?string $descricao = null,
    ) {
    }

    public static function fromArray(int $userId, array $dados): self
    {
        return new self(
            userId: $userId,
            dataInicial: Carbon::parse($dados['data_inicial']),
            dataFinal: Carbon::parse($dados['data_final']),
            regime: RegimeRelatorio::from($dados['regime'] ?? RegimeRelatorio::CAIXA->value),
            contaId: isset($dados['conta_id']) ? (int) $dados['conta_id'] : null,
            categoriaId: isset($dados['category_id']) ? (int) $dados['category_id'] : null,
            orcamentoId: isset($dados['budget_id']) ? (int) $dados['budget_id'] : null,
            tipo: $dados['type'] ?? null,
            status: $dados['status'] ?? null,
            valorMinimo: isset($dados['valor_minimo']) ? (float) $dados['valor_minimo'] : null,
            valorMaximo: isset($dados['valor_maximo']) ? (float) $dados['valor_maximo'] : null,
            descricao: $dados['descricao'] ?? null,
        );
    }

    /** Nome da coluna/expressão de data a considerar, conforme o regime. */
    public function colunaData(): string
    {
        return $this->regime === RegimeRelatorio::CAIXA
            ? 'date'
            : 'COALESCE(date, due_date, created_at)';
    }

    /** Status a considerar, conforme regime + filtro opcional de pago/pendente. */
    public function statuses(): array
    {
        if ($this->regime === RegimeRelatorio::CAIXA) {
            return ['PAID'];
        }

        return $this->status ? [$this->status] : ['PAID', 'PENDING'];
    }

    /**
     * Aplica os filtros "secundários" (conta, categoria, orçamento, tipo, valor, descrição)
     * a um query builder (Eloquent ou Query\Builder — ambos aceitam os mesmos métodos aqui).
     */
    public function aplicarFiltrosSecundarios($query)
    {
        return $query
            ->when($this->contaId, fn ($q) => $q->where('account_id', $this->contaId))
            ->when($this->categoriaId, fn ($q) => $q->where('category_id', $this->categoriaId))
            ->when($this->orcamentoId, fn ($q) => $q->where('budget_id', $this->orcamentoId))
            ->when($this->tipo, fn ($q) => $q->where('type', $this->tipo))
            ->when($this->valorMinimo !== null, fn ($q) => $q->where('amount', '>=', $this->valorMinimo))
            ->when($this->valorMaximo !== null, fn ($q) => $q->where('amount', '<=', $this->valorMaximo))
            ->when($this->descricao, fn ($q) => $q->where('description', 'like', '%' . $this->descricao . '%'));
    }
}
