<?php

namespace App\Actions\Conciliacao;

use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Models\Transacao;
use App\Queries\Conciliacao\RazaoContaQuery;
use App\Support\Conciliacao\Conciliador;
use Illuminate\Support\Facades\DB;

/**
 * Roda a conferência de novo, sem precisar reenviar o extrato:
 *  1. desfaz vínculos que quebraram (lançamento excluído, valor alterado, voltou a pendente...);
 *  2. tenta casar sozinho as linhas pendentes e adiadas com o que foi lançado desde então —
 *     é o "deixei para lançar depois, lancei, agora volto e fecho".
 */
class ReconferirConciliacao
{
    /** @return array{desfeitos: int, conciliados: int} */
    public static function executar(Conciliacao $conciliacao): array
    {
        VinculoConciliacao::exigirAberta($conciliacao);

        return DB::transaction(function () use ($conciliacao) {
            $desfeitos = 0;
            $itens = $conciliacao->itens()->with('transacoes')->get();

            foreach ($itens as $item) {
                if ($item->source === OrigemItemConciliacao::APP) {
                    // "Está certo, só não aparece no extrato": se o lançamento sumiu ou mudou, a confirmação perde o sentido.
                    if (!VinculoConciliacao::valido($item, $conciliacao->account_id)) {
                        Transacao::where('reconciliation_item_id', $item->id)->update(['reconciliation_item_id' => null]);
                        $item->delete();
                    }

                    continue;
                }

                if ($item->status === StatusItemConciliacao::CONCILIADO && !VinculoConciliacao::valido($item, $conciliacao->account_id)) {
                    VinculoConciliacao::desvincular(
                        $item,
                        'Conciliação desfeita automaticamente: o lançamento do app foi alterado ou excluído depois.'
                    );
                    $desfeitos++;
                }
            }

            $abertos = $conciliacao->itens()
                ->where('source', OrigemItemConciliacao::EXTRATO->value)
                ->whereIn('status', [StatusItemConciliacao::PENDENTE->value, StatusItemConciliacao::ADIADO->value])
                ->get()
                ->keyBy('id');

            $conciliados = 0;

            if ($abertos->isNotEmpty()) {
                $livres = RazaoDaConciliacao::livres($conciliacao)->keyBy('chave');
                $pares = RazaoDaConciliacao::conciliador()->parear(RazaoDaConciliacao::linhas($abertos), $livres->all());

                foreach ($pares as $linhaId => $par) {
                    if ($par['confianca'] !== Conciliador::ALTA) {
                        continue;
                    }

                    $conciliados += self::aplicar($conciliacao, $abertos[$linhaId], $par['chave'], 'AUTO') ? 1 : 0;
                }
            }

            return ['desfeitos' => $desfeitos, 'conciliados' => $conciliados];
        });
    }

    /**
     * Vincula a linha à entrada (pela chave), se ela ainda estiver livre e o valor ainda bater.
     */
    public static function aplicar(Conciliacao $conciliacao, ConciliacaoItem $item, string $chave, string $matchedBy): bool
    {
        $transacoes = RazaoContaQuery::transacoesDaChave($chave, $conciliacao->user_id, $conciliacao->account_id);

        if ($transacoes->isEmpty() || abs(RazaoContaQuery::efeitoNoSaldo($transacoes) - $item->valorNoSaldo()) >= 0.005) {
            return false;
        }

        VinculoConciliacao::vincular($item, $transacoes, $matchedBy, RazaoContaQuery::faturaDaChave($chave));

        return true;
    }
}
