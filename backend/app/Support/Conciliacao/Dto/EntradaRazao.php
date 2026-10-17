<?php

namespace App\Support\Conciliacao\Dto;

use App\Enums\TransactionType;
use Carbon\Carbon;

/**
 * Uma "entrada do razão" da conta: o que deveria aparecer como UMA linha no extrato do banco.
 *  - TRANSACAO: um lançamento comum (pix, débito, transferência, receita...);
 *  - FATURA: as compras de cartão baixadas juntas num pagamento de fatura (N lançamentos no app,
 *    1 débito no banco). A chave é "f:{fatura}:{data}" e o valor é a soma com sinal (estorno abate).
 */
final class EntradaRazao
{
    public const ORIGEM_TRANSACAO = 'TRANSACAO';
    public const ORIGEM_FATURA = 'FATURA';

    /**
     * @param int[] $transacaoIds
     */
    public function __construct(
        public readonly string $chave,
        public readonly string $origem,
        public readonly TransactionType $tipo,
        public readonly float $valor,
        public readonly Carbon $data,
        public readonly string $descricao,
        public readonly array $transacaoIds,
        public readonly ?int $faturaId = null,
        public readonly ?string $categoria = null,
        public readonly ?int $itemId = null,
        public readonly bool $transferencia = false,
    ) {
    }

    public function livre(): bool
    {
        return $this->itemId === null;
    }

    public function toArray(): array
    {
        return [
            'chave' => $this->chave,
            'origem' => $this->origem,
            'type' => $this->tipo->value,
            'amount' => $this->valor,
            'date' => $this->data->toDateString(),
            'description' => $this->descricao,
            'transacao_ids' => $this->transacaoIds,
            'fatura_id' => $this->faturaId,
            'categoria' => $this->categoria,
            'transferencia' => $this->transferencia,
            'quantidade' => count($this->transacaoIds),
        ];
    }
}
