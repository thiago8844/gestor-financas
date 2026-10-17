<?php

namespace App\Actions\Conciliacao;

use App\Enums\OrigemItemConciliacao;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Queries\Conciliacao\RazaoContaQuery;
use App\Support\Conciliacao\Conciliador;
use App\Support\Conciliacao\Dto\EntradaRazao;
use App\Support\Conciliacao\Dto\LinhaExtrato;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Peças comuns das ações: a janela de datas, as entradas do app e as linhas do extrato.
 */
class RazaoDaConciliacao
{
    public static function tolerancia(): int
    {
        return max(0, (int) config('conciliacao.tolerancia_dias', 4));
    }

    public static function conciliador(): Conciliador
    {
        return new Conciliador(self::tolerancia());
    }

    /**
     * Entradas do app no mês, mais a tolerância para os dois lados (um pix do dia 30 pode cair
     * no extrato no dia 1º). As que já foram usadas em outra conciliação aparecem como não livres.
     *
     * @return Collection<int, EntradaRazao>
     */
    public static function entradas(Conciliacao $conciliacao): Collection
    {
        $tolerancia = self::tolerancia();

        return RazaoContaQuery::entradas(
            $conciliacao->user_id,
            $conciliacao->account_id,
            Carbon::parse($conciliacao->period_start)->subDays($tolerancia),
            Carbon::parse($conciliacao->period_end)->addDays($tolerancia),
        );
    }

    /** @return Collection<int, EntradaRazao> */
    public static function livres(Conciliacao $conciliacao): Collection
    {
        return self::entradas($conciliacao)->filter(fn (EntradaRazao $e) => $e->livre())->values();
    }

    /**
     * Lançamentos do app, dentro do mês, que não bateram com nenhuma linha do extrato.
     *
     * @param Collection<int, EntradaRazao> $livres
     * @return Collection<int, EntradaRazao>
     */
    public static function soNoApp(Conciliacao $conciliacao, Collection $livres): Collection
    {
        $inicio = Carbon::parse($conciliacao->period_start)->toDateString();
        $fim = Carbon::parse($conciliacao->period_end)->toDateString();

        return $livres->filter(function (EntradaRazao $e) use ($inicio, $fim) {
            $data = $e->data->toDateString();

            return $data >= $inicio && $data <= $fim;
        })->values();
    }

    /**
     * @param Collection<int, ConciliacaoItem> $itens
     * @return LinhaExtrato[]
     */
    public static function linhas(Collection $itens): array
    {
        return $itens
            ->filter(fn (ConciliacaoItem $i) => $i->source === OrigemItemConciliacao::EXTRATO)
            ->map(fn (ConciliacaoItem $i) => self::linha($i))
            ->values()
            ->all();
    }

    public static function linha(ConciliacaoItem $item): LinhaExtrato
    {
        return new LinhaExtrato(
            id: $item->id,
            tipo: $item->type,
            valor: round((float) $item->amount, 2),
            data: Carbon::parse($item->transaction_date)->startOfDay(),
            descricao: (string) $item->description,
        );
    }
}
