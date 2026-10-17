<?php

namespace App\Actions\Conciliacao;

use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Models\Conciliacao;
use Illuminate\Support\Facades\DB;

/**
 * "Aceitar sugestões": aplica de uma vez os pares que o Conciliador sugeriu (mesmo valor, data
 * próxima) e que não eram seguros o bastante para entrar sozinhos.
 */
class AceitarSugestoesConciliacao
{
    /**
     * @param int[]|null $itemIds limita a essas linhas (null = todas as sugestões)
     */
    public static function executar(Conciliacao $conciliacao, ?array $itemIds = null): int
    {
        VinculoConciliacao::exigirAberta($conciliacao);

        return DB::transaction(function () use ($conciliacao, $itemIds) {
            $abertos = $conciliacao->itens()
                ->where('source', OrigemItemConciliacao::EXTRATO->value)
                ->whereIn('status', [StatusItemConciliacao::PENDENTE->value, StatusItemConciliacao::ADIADO->value])
                ->when($itemIds !== null, fn ($q) => $q->whereIn('id', $itemIds))
                ->get()
                ->keyBy('id');

            if ($abertos->isEmpty()) {
                return 0;
            }

            $pares = RazaoDaConciliacao::conciliador()->parear(
                RazaoDaConciliacao::linhas($abertos),
                RazaoDaConciliacao::livres($conciliacao)->all()
            );

            $aplicados = 0;

            foreach ($pares as $linhaId => $par) {
                $aplicados += ReconferirConciliacao::aplicar($conciliacao, $abertos[$linhaId], $par['chave'], 'MANUAL') ? 1 : 0;
            }

            return $aplicados;
        });
    }
}
