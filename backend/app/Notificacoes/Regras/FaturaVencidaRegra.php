<?php

namespace App\Notificacoes\Regras;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transacao;
use App\Models\User;
use App\Notificacoes\RegraNotificacao;

class FaturaVencidaRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'fatura_vencida';
    }

    public function verificar(User $user): array
    {
        $transacoes = Transacao::where('user_id', $user->id)
            ->where('status', TransactionStatus::PENDING)
            ->whereNotNull('due_date')
            ->where('due_date', '<', now()->startOfDay())
            ->get();

        return $transacoes->map(function (Transacao $transacao) {
            $rota = $transacao->type === TransactionType::EXPENSE ? 'despesas' : 'receitas';

            return [
                'title' => 'Fatura vencida',
                'message' => "\"{$transacao->description}\" venceu em {$transacao->due_date->format('d/m/Y')} e ainda não foi paga.",
                'severity' => 'danger',
                'dedupe_key' => "fatura_vencida:transacao:{$transacao->id}",
                'data' => [
                    'transacao_id' => $transacao->id,
                    'amount' => $transacao->amount,
                    'due_date' => $transacao->due_date->toDateString(),
                ],
                'action_url' => "/{$rota}/editar/{$transacao->id}",
            ];
        })->all();
    }
}
