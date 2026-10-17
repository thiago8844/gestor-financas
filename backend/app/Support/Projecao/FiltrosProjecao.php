<?php

namespace App\Support\Projecao;

use Carbon\Carbon;

/**
 * Parâmetros do motor de projeção, já normalizados a partir do array validado da Request.
 * A projeção sempre parte de "hoje": o passado já está refletido no saldo atual das contas.
 */
final class FiltrosProjecao
{
    /** Projeta receitas e despesas juntas: o resultado mostra quanto sobra. */
    public const AMBOS = 'AMBOS';

    /** Só despesas, sem receitas: o saldo final mostra se dá para pagar tudo hoje. */
    public const DESPESAS = 'DESPESAS';

    /** Só receitas, sem pagar nada: o saldo final mostra quanto entraria. */
    public const RECEITAS = 'RECEITAS';

    /** Tudo: lançamentos pendentes + ocorrências futuras de recorrências. */
    public const FONTE_TODAS = 'TODAS';

    /** Só o que já está lançado como pendente (avulsas, parcelas, faturas e recorrências já geradas). */
    public const FONTE_LANCADAS = 'LANCADAS';

    /** Só ocorrências futuras de recorrências que o sistema ainda não lançou. */
    public const FONTE_RECORRENCIAS = 'RECORRENCIAS';

    public function __construct(
        public readonly int $userId,
        public readonly Carbon $hoje,
        public readonly Carbon $dataFinal,
        /** @var int[] Vazio = todas as contas do usuário. */
        public readonly array $contaIds = [],
        /** Valores variáveis (recorrência sem valor fixo) entram com uma estimativa do histórico. */
        public readonly bool $estimarVariaveis = false,
        public readonly string $tipos = self::AMBOS,
        /** De onde vêm os compromissos: ver FONTE_*. Recorrência já lançada conta em LANCADAS, nunca em RECORRENCIAS. */
        public readonly string $fonte = self::FONTE_TODAS,
    ) {
    }

    public function incluiTipo(string $tipoEvento): bool
    {
        return match ($this->tipos) {
            self::DESPESAS => $tipoEvento === 'EXPENSE',
            self::RECEITAS => $tipoEvento === 'INCOME',
            default => true,
        };
    }

    public static function fromArray(int $userId, array $dados, ?Carbon $hoje = null): self
    {
        return new self(
            userId: $userId,
            hoje: ($hoje ?? Carbon::today())->copy()->startOfDay(),
            dataFinal: Carbon::parse($dados['data_final'])->startOfDay(),
            contaIds: array_map('intval', $dados['conta_ids'] ?? []),
            estimarVariaveis: filter_var($dados['estimar_variaveis'] ?? false, FILTER_VALIDATE_BOOLEAN),
            tipos: $dados['tipos'] ?? self::AMBOS,
            fonte: $dados['fonte'] ?? self::FONTE_TODAS,
        );
    }
}
