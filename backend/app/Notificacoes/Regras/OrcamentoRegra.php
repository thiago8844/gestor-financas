<?php

namespace App\Notificacoes\Regras;

use App\Actions\Orcamentos\CalcularOrcamento;
use App\Models\Orcamento;
use App\Models\User;
use App\Notificacoes\PendenciasPorVencimento;
use App\Notificacoes\RegraNotificacao;

/**
 * Orçamento com limite: avisa uma vez por período ao atingir o percentual de alerta e outra
 * ao estourar o limite.
 */
class OrcamentoRegra implements RegraNotificacao
{
    public function tipo(): string
    {
        return 'orcamento';
    }

    public function verificar(User $user): array
    {
        $calculadora = new CalcularOrcamento();
        $itens = [];

        Orcamento::where('user_id', $user->id)->where('active', true)->get()->each(function (Orcamento $orcamento) use ($calculadora, &$itens) {
            $resumo = $calculadora->executar($orcamento);

            if (is_null($resumo['limite']) || is_null($resumo['percentual_utilizado'])) {
                return;
            }

            $periodo = $resumo['periodo']['inicio'] ?? 'unico';
            $gasto = PendenciasPorVencimento::formatarValor($resumo['gasto']);
            $limite = PendenciasPorVencimento::formatarValor($resumo['limite']);
            $dados = ['budget_id' => $orcamento->id, 'percentual' => $resumo['percentual_utilizado']];

            if ($resumo['percentual_utilizado'] >= 100) {
                $itens[] = [
                    'title' => 'Orçamento estourado',
                    'message' => "O orçamento \"{$orcamento->name}\" estourou: {$gasto} gastos de um limite de {$limite}.",
                    'severity' => 'danger',
                    'dedupe_key' => "orcamento_estourado:{$orcamento->id}:{$periodo}",
                    'data' => $dados,
                    'action_url' => "/orcamentos/{$orcamento->id}",
                ];
            } elseif ($resumo['alerta_atingido']) {
                $itens[] = [
                    'title' => 'Orçamento perto do limite',
                    'message' => "O orçamento \"{$orcamento->name}\" já usou {$resumo['percentual_utilizado']}% do limite ({$gasto} de {$limite}).",
                    'severity' => 'warning',
                    'dedupe_key' => "orcamento_alerta:{$orcamento->id}:{$periodo}",
                    'data' => $dados,
                    'action_url' => "/orcamentos/{$orcamento->id}",
                ];
            }
        });

        return $itens;
    }
}
