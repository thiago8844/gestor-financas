<?php

namespace App\Http\Controllers;

use App\Actions\Orcamentos\AtualizarOrcamento;
use App\Actions\Orcamentos\CalcularOrcamento;
use App\Actions\Orcamentos\CriarOrcamento;
use App\Http\Requests\OrcamentoRequest;
use App\Http\Resources\OrcamentoResource;
use App\Models\Orcamento;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OrcamentoController extends Controller
{
    /**
     * Display a listing of the resource, cada um já com o resumo do período atual embutido.
     */
    public function index(Request $request)
    {
        $query = Orcamento::with('periodos')->where('user_id', Auth::id());

        if ($request->filled('active')) {
            $query->where('active', filter_var($request->active, FILTER_VALIDATE_BOOLEAN));
        }

        $orcamentos = $query->orderBy('name')->get();
        $calcular = new CalcularOrcamento();

        $data = $orcamentos->map(fn (Orcamento $orcamento) => array_merge(
            OrcamentoResource::make($orcamento)->resolve($request),
            ['resumo' => $calcular->executar($orcamento)]
        ));

        return response()->json(['data' => $data]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(OrcamentoRequest $request)
    {
        $orcamento = CriarOrcamento::executar(Auth::id(), $request->all());

        return OrcamentoResource::make($orcamento)
            ->additional(['message' => 'Orçamento criado com sucesso'])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Display the specified resource, com o resumo do período pedido (ou o atual, por padrão).
     */
    public function show(string $id, Request $request)
    {
        $orcamento = Orcamento::with('periodos')->find($id);

        if (!$orcamento || Auth::id() !== $orcamento->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $referencia = $request->filled('data_referencia') ? Carbon::parse($request->data_referencia) : null;
        $resumo = (new CalcularOrcamento())->executar($orcamento, $referencia);

        return OrcamentoResource::make($orcamento)->additional(['resumo' => $resumo]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(OrcamentoRequest $request, string $id)
    {
        $orcamento = Orcamento::find($id);

        if (!$orcamento || Auth::id() !== $orcamento->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $orcamento = AtualizarOrcamento::executar($orcamento, $request->all());

        return OrcamentoResource::make($orcamento)
            ->additional(['message' => 'Orçamento atualizado com sucesso']);
    }

    /**
     * Alterna o campo `active` do orçamento.
     */
    public function alternarAtivo(string $id)
    {
        $orcamento = Orcamento::find($id);

        if (!$orcamento || Auth::id() !== $orcamento->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $orcamento->active = !$orcamento->active;
        $orcamento->save();

        return OrcamentoResource::make($orcamento);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Orcamento $orcamento)
    {
        if (Auth::id() !== $orcamento->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $orcamento->delete();

        return response()->json(['message' => 'Orçamento deletado com sucesso'], 200);
    }
}
