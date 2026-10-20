<?php

namespace App\Actions\Faturas;

use App\Models\Cartao;
use App\Models\Fatura;
use Carbon\Carbon;

class ResolverFaturaCompra
{
    /**
     * Determina o ciclo de fechamento (mês) em que uma compra cai, de acordo com o dia de
     * fechamento do cartão. É um passo intermediário: o mês "oficial" da fatura não é este,
     * e sim o mês do vencimento correspondente a este fechamento (ver calcularDatas).
     */
    public static function referenciaParaCompra(Cartao $cartao, Carbon $dataCompra): Carbon
    {
        $ciclo = $dataCompra->copy()->startOfMonth();

        if ($dataCompra->day > $cartao->closing_day) {
            $ciclo = $ciclo->addMonthNoOverflow();
        }

        return $ciclo;
    }

    /**
     * Operação inversa de calcularDatas: dado o mês de competência da fatura (o do vencimento),
     * devolve o ciclo de fechamento que a gera. Se o vencimento é no mês seguinte ao fechamento
     * (due_day <= closing_day), o ciclo é o mês anterior.
     */
    public static function cicloParaReferencia(Cartao $cartao, Carbon $referencia): Carbon
    {
        $ciclo = $referencia->copy()->startOfMonth();

        return $cartao->due_day <= $cartao->closing_day ? $ciclo->subMonthNoOverflow() : $ciclo;
    }

    /**
     * Busca a fatura cujo fechamento cai no ciclo informado, criando-a se ainda não existir.
     * O mês de competência gravado (reference_month) é o mês do vencimento, não o do fechamento:
     * ex. fechamento dia 24, vencimento dia 1 — uma compra em 24/09 fecha no ciclo de setembro,
     * mas cai na "fatura de outubro" porque é isso que vence em 01/10.
     */
    public static function localizarOuCriar(Cartao $cartao, Carbon $ciclo): Fatura
    {
        $ciclo = $ciclo->copy()->startOfMonth();
        [$closingDate, $dueDate] = static::calcularDatas($cartao, $ciclo);
        $referenceMonth = $dueDate->copy()->startOfMonth();

        // whereDate: o mês é comparado como dia, funcionando igual em bancos que guardam a data com hora.
        return Fatura::where('card_id', $cartao->id)
            ->whereDate('reference_month', $referenceMonth->toDateString())
            ->first()
            ?? Fatura::create([
                'card_id' => $cartao->id,
                'reference_month' => $referenceMonth->toDateString(),
                'user_id' => $cartao->user_id,
                'closing_date' => $closingDate,
                'due_date' => $dueDate,
            ]);
    }

    /**
     * Calcula fechamento e vencimento a partir do ciclo de fechamento, sem persistir nada.
     * Usado tanto para criar a fatura de verdade quanto para prever a fatura "vazia" do
     * dashboard, quando ainda não existe nenhuma compra na fatura do mês corrente.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function calcularDatas(Cartao $cartao, Carbon $ciclo): array
    {
        $ciclo = $ciclo->copy()->startOfMonth();

        $closingDate = $ciclo->copy()->day(min($cartao->closing_day, $ciclo->daysInMonth));
        $dueDate = static::calcularVencimento($cartao, $ciclo);

        return [$closingDate, $dueDate];
    }

    /**
     * Ciclo de fechamento cuja fatura tem o vencimento mais próximo, a partir de hoje (o mais
     * urgente: pode já ter fechado e estar só aguardando pagamento). Serve de âncora para o
     * card "fatura atual" do dashboard — dali dá pra navegar ±N ciclos pra frente/trás.
     */
    public static function cicloDoProximoVencimento(Cartao $cartao, Carbon $hoje): Carbon
    {
        $candidato = $hoje->copy()->startOfMonth()->subMonthsNoOverflow(2);
        $hojeInicioDoDia = $hoje->copy()->startOfDay();

        for ($i = 0; $i < 6; $i++) {
            [, $vencimento] = static::calcularDatas($cartao, $candidato);

            if ($vencimento->gte($hojeInicioDoDia)) {
                return $candidato->copy();
            }

            $candidato = $candidato->copy()->addMonthNoOverflow();
        }

        // Não deveria acontecer (a busca cobre 6 meses a partir de hoje-2), mas nunca retorna nulo.
        return $candidato->copy()->subMonthNoOverflow();
    }

    protected static function calcularVencimento(Cartao $cartao, Carbon $ciclo): Carbon
    {
        $mesVencimento = $cartao->due_day <= $cartao->closing_day
            ? $ciclo->copy()->addMonthNoOverflow()
            : $ciclo->copy();

        $dia = min($cartao->due_day, $mesVencimento->daysInMonth);

        return $mesVencimento->copy()->day($dia);
    }
}
