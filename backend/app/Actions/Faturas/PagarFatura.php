<?php

namespace App\Actions\Faturas;

use App\Actions\Faturas\Exceptions\OperacaoFaturaException;
use App\Enums\TipoTransferencia;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Models\Transferencia;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class PagarFatura
{
    private const MESES = [
        1 => 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];

    /**
     * Dá baixa em todas as parcelas pendentes da fatura na data informada. A conta debitada é
     * sempre a das parcelas (a vinculada ao cartão).
     *
     * Pagamento parcial ($valorPago menor que o pendente): o que faltou "rola" para a fatura
     * seguinte, como o banco faz. Viram dois lançamentos ligados por uma transferência FATURA:
     *  - nesta fatura, um crédito "Saldo levado para a fatura de X" (já pago, na data do pagamento),
     *    para que a conta seja debitada só do que saiu de verdade;
     *  - na fatura seguinte, um débito pendente "Saldo restante da fatura de Y".
     * Juros e encargos que o banco cobrar sobre esse saldo entram depois, como despesa normal.
     *
     * @return float o valor levado para a próxima fatura (0 quando o pagamento é total)
     */
    public static function executar(Fatura $fatura, Carbon $data, ?float $valorPago = null): float
    {
        return DB::transaction(function () use ($fatura, $data, $valorPago) {
            $pendentes = Transacao::where('invoice_id', $fatura->id)
                ->where('status', TransactionStatus::PENDING)
                ->lockForUpdate()
                ->get();

            if ($pendentes->isEmpty()) {
                throw new OperacaoFaturaException('Essa fatura já está paga.');
            }

            $devido = round((float) $pendentes->sum(fn (Transacao $t) => $t->valorNaFatura()), 2);
            $levar = 0.0;

            if ($valorPago !== null) {
                $valorPago = round($valorPago, 2);

                if ($valorPago < 0) {
                    throw new OperacaoFaturaException('O valor pago não pode ser negativo.');
                }

                if ($valorPago - $devido >= 0.005) {
                    throw new OperacaoFaturaException(
                        'O valor pago (R$ ' . self::moeda($valorPago) . ') é maior que o pendente da fatura (R$ '
                        . self::moeda($devido) . '). Lance na fatura o que está faltando antes de pagar.'
                    );
                }

                $levar = round($devido - $valorPago, 2);
            }

            Transacao::where('invoice_id', $fatura->id)
                ->where('status', TransactionStatus::PENDING)
                ->update([
                    'status' => TransactionStatus::PAID,
                    'date' => $data->toDateString(),
                ]);

            if ($levar >= 0.01) {
                static::rolarSaldo($fatura, $data, $levar, (int) $pendentes->first()->account_id);
            }

            return $levar;
        });
    }

    private static function rolarSaldo(Fatura $fatura, Carbon $data, float $valor, int $contaId): void
    {
        $cartao = $fatura->cartao;

        // O ciclo de uma fatura é o mês do fechamento; a seguinte é a do ciclo do mês seguinte.
        $proxima = ResolverFaturaCompra::localizarOuCriar(
            $cartao,
            $fatura->closing_date->copy()->startOfMonth()->addMonthNoOverflow()
        );

        if ($proxima->id === $fatura->id) {
            throw new OperacaoFaturaException('Não foi possível identificar a fatura seguinte desse cartão.');
        }

        $mesAtual = self::mesAno($fatura->reference_month);
        $mesProximo = self::mesAno($proxima->reference_month);

        $rolagem = Transferencia::create([
            'user_id' => $fatura->user_id,
            'kind' => TipoTransferencia::FATURA,
            'from_account_id' => $contaId,
            'to_account_id' => $contaId,
            'source_invoice_id' => $fatura->id,
            'target_invoice_id' => $proxima->id,
            'amount' => $valor,
            'date' => $data->toDateString(),
            'description' => "Saldo da fatura {$cartao->name} de {$mesAtual} levado para {$mesProximo}",
        ]);

        $comum = [
            'user_id' => $fatura->user_id,
            'account_id' => $contaId,
            'card_id' => $cartao->id,
            'transfer_id' => $rolagem->id,
            'amount' => $valor,
            'purchase_date' => $data->toDateString(),
        ];

        Transacao::create([
            ...$comum,
            'invoice_id' => $fatura->id,
            'type' => TransactionType::INCOME,
            'description' => "Saldo levado para a fatura de {$mesProximo}",
            'status' => TransactionStatus::PAID,
            'date' => $data->toDateString(),
            'due_date' => $fatura->due_date,
        ]);

        Transacao::create([
            ...$comum,
            'invoice_id' => $proxima->id,
            'type' => TransactionType::EXPENSE,
            'description' => "Saldo restante da fatura de {$mesAtual}",
            'status' => TransactionStatus::PENDING,
            'date' => null,
            'due_date' => $proxima->due_date,
        ]);
    }

    public static function mesAno(Carbon $data): string
    {
        return self::MESES[$data->month] . '/' . $data->year;
    }

    private static function moeda(float $valor): string
    {
        return number_format($valor, 2, ',', '.');
    }
}
