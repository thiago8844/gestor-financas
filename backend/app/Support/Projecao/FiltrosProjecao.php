<?php

namespace App\Support\Projecao;

use Carbon\Carbon;

/**
 * Parâmetros do motor de projeção, já normalizados a partir do array validado da Request.
 * A projeção sempre parte de "hoje": o passado já está refletido no saldo atual das contas.
 */
final class FiltrosProjecao
{
    public function __construct(
        public readonly int $userId,
        public readonly Carbon $hoje,
        public readonly Carbon $dataFinal,
        /** @var int[] Vazio = todas as contas do usuário. */
        public readonly array $contaIds = [],
        /** Valores variáveis (recorrência sem valor fixo) entram com uma estimativa do histórico. */
        public readonly bool $estimarVariaveis = false,
    ) {
    }

    public static function fromArray(int $userId, array $dados, ?Carbon $hoje = null): self
    {
        return new self(
            userId: $userId,
            hoje: ($hoje ?? Carbon::today())->copy()->startOfDay(),
            dataFinal: Carbon::parse($dados['data_final'])->startOfDay(),
            contaIds: array_map('intval', $dados['conta_ids'] ?? []),
            estimarVariaveis: filter_var($dados['estimar_variaveis'] ?? false, FILTER_VALIDATE_BOOLEAN),
        );
    }
}
