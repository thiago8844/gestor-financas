<?php

namespace App\Support\Relatorios;

use App\Enums\RegimeRelatorio;
use Carbon\Carbon;

/**
 * Filtros do relatório de Resultado Financeiro. Mais enxuto que FiltrosFluxoCaixa
 * de propósito: aqui a categoria já É o eixo do relatório (a quebra hierárquica da
 * tabela), então não faz sentido também filtrar por uma categoria específica.
 */
final class FiltrosResultadoFinanceiro
{
    public function __construct(
        public readonly int $userId,
        public readonly Carbon $dataInicial,
        public readonly Carbon $dataFinal,
        public readonly RegimeRelatorio $regime,
        public readonly ?int $contaId = null,
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
        );
    }

    /** Nome da coluna/expressão de data a considerar, conforme o regime. */
    public function colunaData(): string
    {
        return $this->regime === RegimeRelatorio::CAIXA
            ? 'date'
            : 'COALESCE(date, due_date, created_at)';
    }

    /** Status a considerar, conforme o regime. */
    public function statuses(): array
    {
        return $this->regime === RegimeRelatorio::CAIXA ? ['PAID'] : ['PAID', 'PENDING'];
    }
}
