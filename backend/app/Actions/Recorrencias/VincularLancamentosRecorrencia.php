<?php

namespace App\Actions\Recorrencias;

use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use App\Support\Recorrencia\CalculadoraProximaOcorrencia;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Liga lançamentos que já aconteceram a uma recorrência, sem criar nada novo. Serve para casos
 * como: o salário foi lançado na mão por meses, e agora a recorrência (talvez sem valor fixo)
 * passa a "reconhecer" esses lançamentos — o que alimenta a estimativa da projeção futura.
 */
class VincularLancamentosRecorrencia
{
    /** Lançamentos que podem ser vinculados: passados, avulsos (sem parcela/recorrência/transferência) do tipo e da origem da recorrência. */
    public static function elegiveis(RecorrenciaTransacao $recorrencia): Builder
    {
        $query = Transacao::query()
            ->where('user_id', $recorrencia->user_id)
            ->where('type', $recorrencia->type->value)
            ->whereNull('recurring_transaction_id')
            ->whereNull('transfer_id')
            ->where('is_initial_balance', false)
            ->where(fn ($q) => $q->whereNull('installment_total')->orWhere('installment_total', '<=', 1))
            ->whereRaw('DATE(COALESCE(purchase_date, date, due_date)) <= ?', [now()->toDateString()]);

        // Recorrência no cartão só recebe compras daquele cartão; as de conta, lançamentos fora de cartão.
        return $recorrencia->card_id
            ? $query->where('card_id', $recorrencia->card_id)
            : $query->whereNull('card_id');
    }

    /** @return int quantidade de lançamentos vinculados */
    public static function vincular(RecorrenciaTransacao $recorrencia, array $transacaoIds): int
    {
        return DB::transaction(function () use ($recorrencia, $transacaoIds) {
            $transacoes = self::elegiveis($recorrencia)->whereIn('id', $transacaoIds)->get();

            if ($transacoes->count() !== count(array_unique($transacaoIds))) {
                throw new \DomainException('Alguns lançamentos não podem ser vinculados a esta recorrência.');
            }

            Transacao::whereIn('id', $transacoes->pluck('id'))
                ->update(['recurring_transaction_id' => $recorrencia->id]);

            self::avancarProximaGeracao($recorrencia);

            return $transacoes->count();
        });
    }

    public static function desvincular(RecorrenciaTransacao $recorrencia, Transacao $transacao): void
    {
        // Só desfaz o vínculo: não recalcula a próxima geração nem apaga nada.
        $transacao->update(['recurring_transaction_id' => null]);
    }

    /**
     * Ocorrências até a data do último lançamento vinculado já "aconteceram": a próxima geração
     * começa depois dela, para não criar uma cópia do que o usuário já tinha lançado.
     */
    private static function avancarProximaGeracao(RecorrenciaTransacao $recorrencia): void
    {
        $ultimo = Transacao::where('recurring_transaction_id', $recorrencia->id)
            ->selectRaw('MAX(DATE(COALESCE(purchase_date, date, due_date))) AS ultimo')
            ->value('ultimo');

        if (!$ultimo || !$recorrencia->next_run_date) {
            return;
        }

        $ultimaData = Carbon::parse($ultimo)->startOfDay();

        if ($recorrencia->next_run_date->gt($ultimaData)) {
            return;
        }

        $proxima = (new CalculadoraProximaOcorrencia())->proximaAPartirDe($recorrencia, $ultimaData);

        if ($recorrencia->end_date && $proxima->gt($recorrencia->end_date)) {
            $recorrencia->active = false;
        }

        $recorrencia->next_run_date = $proxima->toDateString();
        $recorrencia->save();
    }
}
