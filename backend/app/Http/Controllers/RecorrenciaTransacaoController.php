<?php

namespace App\Http\Controllers;

use App\Actions\AtualizarRecorrenciaTransacao;
use App\Actions\CriarRecorrenciaTransacao;
use App\Http\Requests\RecorrenciaTransacaoRequest;
use App\Http\Resources\RecorrenciaTransacaoResource;
use App\Models\RecorrenciaTransacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RecorrenciaTransacaoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = RecorrenciaTransacao::with(['categoria', 'conta'])
            ->where('user_id', Auth::id());

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('active')) {
            $query->where('active', filter_var($request->active, FILTER_VALIDATE_BOOLEAN));
        }

        $recorrencias = $query->orderBy('next_run_date')->get();

        return RecorrenciaTransacaoResource::collection($recorrencias);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(RecorrenciaTransacaoRequest $request)
    {
        $recorrencia = CriarRecorrenciaTransacao::executar(Auth::id(), $request->all());

        return RecorrenciaTransacaoResource::make($recorrencia)
            ->additional(['message' => 'Recorrência criada com sucesso'])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $recorrencia = RecorrenciaTransacao::with(['categoria', 'conta'])->find($id);

        if (!$recorrencia || Auth::id() !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        return RecorrenciaTransacaoResource::make($recorrencia);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(RecorrenciaTransacaoRequest $request, string $id)
    {
        $recorrencia = RecorrenciaTransacao::find($id);

        if (!$recorrencia || Auth::id() !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $recorrencia = AtualizarRecorrenciaTransacao::executar($recorrencia, Auth::id(), $request->all());

        return RecorrenciaTransacaoResource::make($recorrencia)
            ->additional(['message' => 'Recorrência atualizada com sucesso']);
    }

    /**
     * Alterna o campo `active` da recorrência (pausar/retomar geração).
     */
    public function alternarAtivo(string $id)
    {
        $recorrencia = RecorrenciaTransacao::find($id);

        if (!$recorrencia || Auth::id() !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $recorrencia->active = !$recorrencia->active;

        // Ao reativar, recalcula a próxima geração a partir de hoje pra não gerar tudo que ficou pra trás.
        if ($recorrencia->active) {
            $hoje = now()->startOfDay();
            $inicio = $recorrencia->start_date->greaterThan($hoje) ? $recorrencia->start_date : $hoje;
            $recorrencia->next_run_date = $recorrencia->proximaOcorrenciaAPartirDe($inicio->copy()->subDay())->toDateString();
        }

        $recorrencia->save();

        return RecorrenciaTransacaoResource::make($recorrencia);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(RecorrenciaTransacao $recorrencia)
    {
        if (Auth::id() !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $recorrencia->delete();

        return response()->json(['message' => 'Recorrência deletada com sucesso'], 200);
    }
}
