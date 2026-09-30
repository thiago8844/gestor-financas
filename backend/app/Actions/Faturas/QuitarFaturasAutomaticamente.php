<?php

namespace App\Actions\Faturas;

use App\Enums\TransactionStatus;
use App\Models\ConfiguracaoUsuario;
use App\Models\Fatura;
use App\Models\Notificacao;
use App\Models\Transacao;
use Illuminate\Support\Facades\DB;

/**
 * Para usuários com "quitar faturas automaticamente" ligado (débito automático), marca como
 * paga, na data do vencimento, toda fatura que já venceu (ou vence hoje) e ainda tem pendências.
 * Só considera faturas com vencimento a partir do dia em que o usuário ligou a opção.
 */
class QuitarFaturasAutomaticamente
{
    /** @return int quantidade de faturas quitadas */
    public function executar(): int
    {
        $hoje = now()->toDateString();
        $quitadas = 0;

        ConfiguracaoUsuario::query()
            ->where('auto_pay_invoices', true)
            ->whereNotNull('auto_pay_invoices_since')
            ->chunkById(200, function ($configuracoes) use ($hoje, &$quitadas) {
                foreach ($configuracoes as $configuracao) {
                    $faturas = Fatura::where('user_id', $configuracao->user_id)
                        ->whereDate('due_date', '>=', $configuracao->auto_pay_invoices_since->toDateString())
                        ->whereDate('due_date', '<=', $hoje)
                        ->whereHas('parcelas', fn ($q) => $q->where('status', TransactionStatus::PENDING))
                        ->with('cartao')
                        ->get();

                    foreach ($faturas as $fatura) {
                        $this->quitar($fatura);
                        $quitadas++;
                    }
                }
            });

        return $quitadas;
    }

    private function quitar(Fatura $fatura): void
    {
        DB::transaction(function () use ($fatura) {
            $pendentes = Transacao::where('invoice_id', $fatura->id)
                ->where('status', TransactionStatus::PENDING);

            $valor = (float) (clone $pendentes)->sum('amount');

            $pendentes->update([
                'status' => TransactionStatus::PAID,
                'date' => $fatura->due_date->toDateString(),
            ]);

            // Deixa rastro: o pagamento aconteceu sem o usuário fazer nada.
            Notificacao::firstOrCreate(
                ['user_id' => $fatura->user_id, 'dedupe_key' => "fatura_quitada_automaticamente:{$fatura->id}:" . now()->toDateString()],
                [
                    'type' => 'fatura_quitada_automaticamente',
                    'title' => 'Fatura quitada automaticamente',
                    'message' => "A fatura do cartão {$fatura->cartao->name} (venc. {$fatura->due_date->format('d/m/Y')}) foi marcada como paga - R$ "
                        . number_format($valor, 2, ',', '.') . '.',
                    'severity' => 'info',
                    'data' => ['fatura_id' => $fatura->id, 'card_id' => $fatura->card_id, 'amount' => $valor],
                    'action_url' => '/cartoes',
                ]
            );
        });
    }
}
