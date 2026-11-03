<?php

namespace App\Actions\Faturas;

use App\Actions\Faturas\Exceptions\OperacaoFaturaException;
use App\Enums\TransactionStatus;
use App\Models\Fatura;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class AjustarFechamentoFatura
{
    /** Menor período, em dias, que uma fatura vizinha pode ter depois do ajuste. */
    public const DIAS_MINIMOS_POR_FATURA = 3;

    /**
     * Ajusta à mão o fechamento de uma fatura (bancos cuja regra muda todo mês). A fatura seguinte
     * passa a abrir no dia depois do novo fechamento e as despesas são realocadas: o fechamento
     * dela não muda, então só um pedaço do período dela é cedido ou recuperado, nunca a fatura toda.
     * Cada fatura (a ajustada e a seguinte) precisa ficar com pelo menos 3 dias.
     *
     * Com `$novoFechamento` nulo o ajuste é desfeito e a fatura volta à regra do cartão.
     *
     * @return int quantidade de despesas que mudaram de fatura
     */
    public static function executar(Fatura $fatura, ?Carbon $novoFechamento): int
    {
        $cartao = $fatura->cartao;
        $referencia = $fatura->reference_month->copy()->startOfMonth();
        $novoFechamento = $novoFechamento?->copy()->startOfDay()
            ?? ResolverFaturaCompra::datasPorReferencia($cartao, $referencia)[0];

        if (static::temPagamento($fatura)) {
            throw new OperacaoFaturaException('Essa fatura já tem pagamento e não pode ter o fechamento ajustado.');
        }

        $seguinte = Fatura::where('card_id', $cartao->id)
            ->whereDate('reference_month', $referencia->copy()->addMonthNoOverflow()->toDateString())
            ->first();

        if ($seguinte && static::temPagamento($seguinte)) {
            throw new OperacaoFaturaException('A fatura seguinte já tem pagamento; o ajuste mexeria nas despesas dela.');
        }

        $fixos = ResolverFaturaCompra::fechamentosFixos($cartao);
        $anterior = ResolverFaturaCompra::fechamentoEfetivo($cartao, $referencia->copy()->subMonthNoOverflow(), $fixos);
        $posterior = ResolverFaturaCompra::fechamentoEfetivo($cartao, $referencia->copy()->addMonthNoOverflow(), $fixos);

        $minimo = $anterior->copy()->addDays(self::DIAS_MINIMOS_POR_FATURA);
        $maximo = $posterior->copy()->subDays(self::DIAS_MINIMOS_POR_FATURA);

        if ($fatura->due_date->copy()->subDay()->lt($maximo)) {
            $maximo = $fatura->due_date->copy()->subDay();
        }

        if ($novoFechamento->lt($minimo) || $novoFechamento->gt($maximo)) {
            throw new OperacaoFaturaException(sprintf(
                'O fechamento deve ficar entre %s e %s: cada fatura precisa ter pelo menos %d dias e o fechamento deve ser antes do vencimento.',
                $minimo->format('d/m/Y'),
                $maximo->format('d/m/Y'),
                self::DIAS_MINIMOS_POR_FATURA,
            ));
        }

        $voltaParaRegra = $novoFechamento->equalTo(ResolverFaturaCompra::datasPorReferencia($cartao, $referencia)[0]);

        return DB::transaction(function () use ($fatura, $cartao, $novoFechamento, $voltaParaRegra) {
            $fatura->update([
                'closing_date' => $novoFechamento,
                'closing_manual' => !$voltaParaRegra,
            ]);

            return RealocarDespesasCartao::executar($cartao);
        });
    }

    private static function temPagamento(Fatura $fatura): bool
    {
        return $fatura->parcelas()->where('status', TransactionStatus::PAID)->exists();
    }
}
