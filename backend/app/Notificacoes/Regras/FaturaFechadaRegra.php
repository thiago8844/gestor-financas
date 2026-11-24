<?php

namespace App\Notificacoes\Regras;

use App\Models\Fatura;
use App\Models\User;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Uma vez por fatura, quando ela fecha (a partir da data de fechamento): informa o valor final e o vencimento.
 */
class FaturaFechadaRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'fatura_fechada';
    }

    public function verificar(User $user): array
    {
        $hoje = now()->startOfDay();

        return Fatura::where('user_id', $user->id)
            ->whereDate('closing_date', '<=', $hoje->toDateString())
            ->whereDate('closing_date', '>=', $hoje->copy()->subDays(2)->toDateString())
            ->whereDate('due_date', '>=', $hoje->toDateString())
            ->with(['cartao', 'parcelas'])
            ->get()
            ->map(function (Fatura $fatura) {
                $resumo = $fatura->resumoValores();

                if ($resumo['pendente'] <= 0) {
                    return null;
                }

                return [
                    'title' => 'Fatura fechada',
                    'message' => "A fatura do cartão {$fatura->cartao->name} fechou em {$fatura->closing_date->format('d/m/Y')}: "
                        . PendenciasPorVencimento::formatarValor($resumo['pendente'])
                        . ", vence em {$fatura->due_date->format('d/m/Y')}.",
                    'severity' => 'info',
                    'dedupe_key' => "fatura_fechada:{$fatura->id}",
                    'data' => ['fatura_id' => $fatura->id, 'card_id' => $fatura->card_id, 'amount' => $resumo['pendente']],
                    'action_url' => '/cartoes',
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
