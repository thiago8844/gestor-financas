<?php

namespace App\Http\Controllers;

use App\Actions\Parcelas\AtualizarGrupoParcelas;
use App\Actions\Parcelas\Exceptions\GrupoParcelasException;
use App\Http\Requests\AtualizarGrupoParcelasRequest;
use App\Http\Resources\TransacaoResource;
use App\Models\Transacao;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Auth;

/**
 * Operações sobre um grupo de parcelas (uma compra parcelada inteira), identificado por `installment_group`.
 */
class ParcelaController extends Controller
{
    public function show(string $grupo)
    {
        $parcelas = AtualizarGrupoParcelas::carregar(Auth::id(), $grupo);

        if ($parcelas->isEmpty()) {
            return response()->json(['message' => 'Grupo de parcelas não encontrado'], 404);
        }

        return response()->json(['data' => $this->montar($grupo, $parcelas)]);
    }

    public function update(AtualizarGrupoParcelasRequest $request, string $grupo)
    {
        $antes = AtualizarGrupoParcelas::carregar(Auth::id(), $grupo);

        if ($antes->isEmpty()) {
            return response()->json(['message' => 'Grupo de parcelas não encontrado'], 404);
        }

        $totalAntes = round((float) $antes->sum('amount'), 2);

        try {
            $depois = AtualizarGrupoParcelas::executar(Auth::id(), $grupo, $request->validated());
        } catch (GrupoParcelasException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'message' => 'Parcelas atualizadas com sucesso',
            'total_anterior' => $totalAntes,
            'data' => $this->montar($grupo, $depois),
        ]);
    }

    public function destroy(string $grupo)
    {
        try {
            $excluidas = AtualizarGrupoParcelas::excluir(Auth::id(), $grupo);
        } catch (GrupoParcelasException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['message' => 'Grupo de parcelas excluído com sucesso', 'excluidas' => $excluidas]);
    }

    /** @param Collection<int, Transacao> $parcelas */
    private function montar(string $grupo, Collection $parcelas): array
    {
        $primeira = $parcelas->first();

        return [
            'installment_group' => $grupo,
            'tipo' => $primeira->card_id !== null ? 'cartao' : 'conta',
            'type' => $primeira->type,
            'description' => $primeira->description,
            'category_id' => $primeira->category_id,
            'account_id' => $primeira->account_id,
            'card_id' => $primeira->card_id,
            'purchase_date' => $primeira->purchase_date?->toDateString(),
            'total' => round((float) $parcelas->sum('amount'), 2),
            'pagas' => $parcelas->filter(fn (Transacao $p) => $p->isPaga())->count(),
            'pendentes' => $parcelas->reject(fn (Transacao $p) => $p->isPaga())->count(),
            'parcelas' => $parcelas->map(fn (Transacao $p) => array_merge(
                TransacaoResource::make($p)->resolve(),
                ['travada' => AtualizarGrupoParcelas::travada($p)],
            ))->values(),
        ];
    }
}
