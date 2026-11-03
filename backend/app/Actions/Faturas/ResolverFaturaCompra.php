<?php

namespace App\Actions\Faturas;

use App\Enums\RegraFechamentoCartao;
use App\Enums\TransactionStatus;
use App\Models\Cartao;
use App\Models\Fatura;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class ResolverFaturaCompra
{
    /**
     * Determina o ciclo de fechamento (mês) em que uma compra cai, de acordo com o dia de
     * fechamento do cartão. É um passo intermediário: o mês "oficial" da fatura não é este,
     * e sim o mês do vencimento correspondente a este fechamento (ver calcularDatas).
     */
    public static function referenciaParaCompra(Cartao $cartao, Carbon $dataCompra): Carbon
    {
        if (static::fechaPorDiasAntes($cartao)) {
            $inicio = $dataCompra->copy()->startOfMonth()->subMonthNoOverflow();

            for ($i = 0; $i < 4; $i++) {
                [$fechamento] = static::datasPorReferencia($cartao, $inicio->copy()->addMonthsNoOverflow($i));

                if ($fechamento->gte($dataCompra->copy()->startOfDay())) {
                    return $fechamento->startOfMonth();
                }
            }
        }

        $ciclo = $dataCompra->copy()->startOfMonth();

        if (!static::fechaPorDiasAntes($cartao) && $dataCompra->day > $cartao->closing_day) {
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

        if (static::fechaPorDiasAntes($cartao)) {
            return static::datasPorReferencia($cartao, $ciclo)[0]->startOfMonth();
        }

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
        [, $dueDate] = static::calcularDatas($cartao, $ciclo);

        return static::localizarOuCriarPorReferencia($cartao, $dueDate);
    }

    /**
     * Busca (ou cria) a fatura pelo mês de competência, que é o mês do vencimento. Fatura nova
     * nasce com as datas da regra do cartão.
     */
    public static function localizarOuCriarPorReferencia(Cartao $cartao, Carbon $referencia): Fatura
    {
        $referenceMonth = $referencia->copy()->startOfMonth();

        // whereDate: o mês é comparado como dia, funcionando igual em bancos que guardam a data com hora.
        return Fatura::where('card_id', $cartao->id)
            ->whereDate('reference_month', $referenceMonth->toDateString())
            ->first()
            ?? Fatura::create([
                'card_id' => $cartao->id,
                'reference_month' => $referenceMonth->toDateString(),
                'user_id' => $cartao->user_id,
                ...array_combine(['closing_date', 'due_date'], static::datasPorReferencia($cartao, $referenceMonth)),
            ]);
    }

    public static function fechaPorDiasAntes(Cartao $cartao): bool
    {
        return $cartao->closing_rule === RegraFechamentoCartao::DIAS_ANTES_VENCIMENTO
            && $cartao->closing_days_before_due !== null;
    }

    /**
     * Fechamento e vencimento da fatura de um mês de competência (o do vencimento), pela regra do
     * cartão — sem considerar ajustes manuais.
     *
     * @return array{0: Carbon, 1: Carbon}
     */
    public static function datasPorReferencia(Cartao $cartao, Carbon $referencia): array
    {
        $referencia = $referencia->copy()->startOfMonth();
        $vencimento = $referencia->copy()->day(min($cartao->due_day, $referencia->daysInMonth));

        if (static::fechaPorDiasAntes($cartao)) {
            return [$vencimento->copy()->subDays($cartao->closing_days_before_due), $vencimento];
        }

        $ciclo = $cartao->due_day <= $cartao->closing_day ? $referencia->copy()->subMonthNoOverflow() : $referencia;

        return [$ciclo->copy()->day(min($cartao->closing_day, $ciclo->daysInMonth)), $vencimento];
    }

    /**
     * Mês de competência da fatura em que uma compra cai, respeitando os fechamentos já fixados:
     * ajustados à mão ou de faturas pagas (que não se mexem mais). Aqui a regra do cartão é só
     * o ponto de partida; a primeira fatura (da vizinhança) que ainda fecha na data da compra ou depois vence.
     */
    public static function referenciaFaturaParaCompra(Cartao $cartao, Carbon $dataCompra, ?Collection $fixos = null): Carbon
    {
        $fixos ??= static::fechamentosFixos($cartao);
        $dia = $dataCompra->copy()->startOfDay();

        [, $vencimento] = static::calcularDatas($cartao, static::referenciaParaCompra($cartao, $dataCompra));
        $base = $vencimento->copy()->startOfMonth();

        for ($i = -2; $i <= 1; $i++) {
            $referencia = $base->copy()->addMonthsNoOverflow($i);

            if (static::fechamentoEfetivo($cartao, $referencia, $fixos)->gte($dia)) {
                return $referencia;
            }
        }

        return $base->copy()->addMonthNoOverflow();
    }

    /**
     * Fechamento vigente da fatura de um mês: o gravado se ele foi fixado, senão o da regra.
     *
     * @param  Collection<string, Carbon>  $fixos  chave = mês de competência (Y-m-d), valor = fechamento
     */
    public static function fechamentoEfetivo(Cartao $cartao, Carbon $referencia, Collection $fixos): Carbon
    {
        $referencia = $referencia->copy()->startOfMonth();

        return $fixos->get($referencia->toDateString())?->copy()
            ?? static::datasPorReferencia($cartao, $referencia)[0];
    }

    /**
     * Fechamentos que a regra do cartão não pode mais alterar: ajustados à mão e de faturas com algo pago.
     *
     * @return Collection<string, Carbon>
     */
    public static function fechamentosFixos(Cartao $cartao): Collection
    {
        return Fatura::where('card_id', $cartao->id)
            ->where(fn ($q) => $q->where('closing_manual', true)
                ->orWhereHas('parcelas', fn ($p) => $p->where('status', TransactionStatus::PAID)))
            ->get()
            ->mapWithKeys(fn (Fatura $f) => [$f->reference_month->toDateString() => $f->closing_date->copy()]);
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

        if (static::fechaPorDiasAntes($cartao)) {
            // O ciclo é o mês do fechamento; o vencimento correspondente está nele ou nos meses seguintes.
            for ($i = 0; $i < 3; $i++) {
                $datas = static::datasPorReferencia($cartao, $ciclo->copy()->addMonthsNoOverflow($i));

                if ($datas[0]->isSameMonth($ciclo)) {
                    return $datas;
                }
            }

            return static::datasPorReferencia($cartao, $ciclo->copy()->addMonthNoOverflow());
        }

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
