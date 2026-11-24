<?php

namespace App\Notificacoes\Regras;

use App\Models\Conta;
use App\Models\User;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Conta ativa com saldo negativo: lembra uma vez por semana enquanto continuar negativa.
 */
class SaldoNegativoRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'saldo_negativo';
    }

    public function verificar(User $user): array
    {
        $semana = now()->format('o-\WW');

        return Conta::where('user_id', $user->id)
            ->where('active', true)
            ->get()
            ->filter(fn (Conta $conta) => $conta->saldo < 0)
            ->map(fn (Conta $conta) => [
                'title' => 'Saldo negativo',
                'message' => "A conta {$conta->name} está com saldo negativo: " . PendenciasPorVencimento::formatarValor($conta->saldo) . '.',
                'severity' => 'danger',
                'dedupe_key' => "saldo_negativo:{$conta->id}:{$semana}",
                'data' => ['account_id' => $conta->id, 'saldo' => $conta->saldo],
                'action_url' => "/contas/editar/{$conta->id}",
            ])
            ->values()
            ->all();
    }
}
