<?php

namespace App\Http\Controllers;

use App\Actions\Ofx\AplicarRegraOfx;
use App\Actions\Ofx\CriarRegraOfx;
use App\Http\Requests\Ofx\CriarRegraOfxRequest;
use App\Http\Resources\Ofx\OfxImportRuleResource;
use App\Models\OfxImportRule;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RegraImportacaoOfxController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $regras = OfxImportRule::where('user_id', Auth::id())->orderByDesc('created_at')->get();

        return OfxImportRuleResource::collection($regras);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(CriarRegraOfxRequest $request)
    {
        $regra = CriarRegraOfx::executar(Auth::id(), $request->all());

        $aplicadas = null;

        if ($request->boolean('aplicar_ao_lote') && $request->filled('ofx_import_id')) {
            $aplicadas = (new AplicarRegraOfx())->executar($regra, $request->integer('ofx_import_id'));
        }

        return OfxImportRuleResource::make($regra)
            ->additional([
                'message' => 'Regra criada com sucesso',
                'itens_aplicados' => $aplicadas,
            ])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Aplica uma regra existente a uma importação específica (ou a todos os itens pendentes do usuário).
     */
    public function aplicar(Request $request, string $id)
    {
        $regra = OfxImportRule::find($id);

        if (!$regra || Auth::id() !== $regra->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $quantidade = (new AplicarRegraOfx())->executar($regra, $request->integer('ofx_import_id') ?: null);

        return response()->json(['message' => 'Regra aplicada com sucesso', 'itens_aplicados' => $quantidade]);
    }

    /**
     * Alterna o campo `active` da regra.
     */
    public function alternarAtivo(string $id)
    {
        $regra = OfxImportRule::find($id);

        if (!$regra || Auth::id() !== $regra->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $regra->active = !$regra->active;
        $regra->save();

        return OfxImportRuleResource::make($regra);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $regra = OfxImportRule::find($id);

        if (!$regra || Auth::id() !== $regra->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $regra->delete();

        return response()->json(['message' => 'Regra deletada com sucesso']);
    }
}
