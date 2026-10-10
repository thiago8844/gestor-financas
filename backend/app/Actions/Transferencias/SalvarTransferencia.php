<?php

namespace App\Actions\Transferencias;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transacao;
use App\Models\Transferencia;
use Illuminate\Support\Facades\DB;

class SalvarTransferencia
{
    /**
     * Cria (ou atualiza, se $transferencia vier preenchida) a transferência e as duas transações
     * que a materializam: EXPENSE na conta de origem e INCOME na de destino.
     */
    public static function executar(int $userId, array $dados, ?Transferencia $transferencia = null): Transferencia
    {
        return DB::transaction(function () use ($userId, $dados, $transferencia) {
            $campos = [
                'from_account_id' => $dados['from_account_id'],
                'to_account_id' => $dados['to_account_id'],
                'amount' => $dados['amount'],
                'date' => $dados['date'],
                'description' => $dados['description'] ?? null,
            ];

            if ($transferencia) {
                $transferencia->update($campos);
            } else {
                $transferencia = Transferencia::create(['user_id' => $userId, ...$campos]);
            }

            $descricao = $transferencia->description ?: 'Transferência entre contas';

            $lados = [
                TransactionType::EXPENSE->value => $transferencia->from_account_id,
                TransactionType::INCOME->value => $transferencia->to_account_id,
            ];

            foreach ($lados as $tipo => $contaId) {
                Transacao::updateOrCreate(
                    ['transfer_id' => $transferencia->id, 'type' => $tipo],
                    [
                        'user_id' => $userId,
                        'account_id' => $contaId,
                        'amount' => $transferencia->amount,
                        'status' => TransactionStatus::PAID,
                        'date' => $transferencia->date,
                        'description' => $descricao,
                    ]
                );
            }

            return $transferencia->load(['contaOrigem', 'contaDestino']);
        });
    }
}
