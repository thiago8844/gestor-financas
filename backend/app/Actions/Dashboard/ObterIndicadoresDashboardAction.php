<?php

namespace App\Actions\Dashboard;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\Transacao;
use App\Queries\Dashboard\IndicadoresMesDashboardQuery;
use Illuminate\Support\Facades\Auth;

class ObterIndicadoresDashboardAction
{
    public static function execute()
    {
        $userId = Auth::id();
        $inicioMes = now()->startOfMonth();
        $fimMes = now()->endOfMonth();

        $indicadoresMes = IndicadoresMesDashboardQuery::query($userId, $inicioMes, $fimMes);

        $contasNoPatrimonio = Conta::where('user_id', $userId)->get()->filter(fn ($conta) => $conta->include_in_networth);
        $saldoDisponivel = $contasNoPatrimonio->sum(fn ($conta) => $conta->saldo);

        // Despesas pendentes (ex.: parcelas de fatura ainda não paga) são dívida:
        // já comprometem o patrimônio hoje, mesmo antes do dinheiro sair da conta.
        $despesasPendentes = Transacao::whereIn('account_id', $contasNoPatrimonio->pluck('id'))
            ->where('user_id', $userId)
            ->where('type', TransactionType::EXPENSE)
            ->where('status', TransactionStatus::PENDING)
            ->where('is_initial_balance', false)
            ->sum('amount');

        $patrimonio = $saldoDisponivel - $despesasPendentes;

        return [
          ...$indicadoresMes,
          'patrimonio_liquido' => $patrimonio
        ];
    }
}