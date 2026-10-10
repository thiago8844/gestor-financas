<?php

namespace App\Http\Controllers;

use App\Actions\AtualizarRecorrenciaTransacao;
use App\Actions\CriarRecorrenciaTransacao;
use App\Actions\Recorrencias\VincularLancamentosRecorrencia;
use App\Http\Requests\RecorrenciaTransacaoRequest;
use App\Http\Resources\RecorrenciaTransacaoResource;
use App\Http\Resources\TransacaoResource;
use App\Models\Transacao;
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
        $query = RecorrenciaTransacao::with(['categoria', 'conta', 'cartao'])
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
        $recorrencia = RecorrenciaTransacao::with(['categoria', 'conta', 'cartao'])->find($id);

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

    /**
     * Lançamentos passados que ainda não pertencem a nenhuma recorrência e podem ser vinculados a esta.
     */
    public function lancamentosCandidatos(Request $request, RecorrenciaTransacao $recorrencia)
    {
        if (Auth::id() !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $query = VincularLancamentosRecorrencia::elegiveis($recorrencia)
            ->with(['categoria:id,name', 'conta:id,name', 'cartao:id,name'])
            ->orderByRaw('DATE(COALESCE(purchase_date, date, due_date)) DESC')
            ->orderBy('id', 'desc');

        if ($request->filled('busca')) {
            $query->where('description', 'like', '%' . $request->string('busca') . '%');
        }

        return TransacaoResource::collection($query->limit(300)->get());
    }

    /**
     * Lançamentos que já estão vinculados a esta recorrência (mais recentes primeiro).
     */
    public function lancamentosVinculados(RecorrenciaTransacao $recorrencia)
    {
        if (Auth::id() !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $transacoes = Transacao::where('recurring_transaction_id', $recorrencia->id)
            ->with(['categoria:id,name', 'conta:id,name', 'cartao:id,name'])
            ->orderByRaw('DATE(COALESCE(purchase_date, date, due_date)) DESC')
            ->get();

        return TransacaoResource::collection($transacoes);
    }

    /**
     * Vincula lançamentos já existentes à recorrência.
     */
    public function vincularLancamentos(Request $request, RecorrenciaTransacao $recorrencia)
    {
        if (Auth::id() !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $dados = $request->validate([
            'transacao_ids' => 'required|array|min:1',
            'transacao_ids.*' => 'integer',
        ]);

        try {
            $quantidade = VincularLancamentosRecorrencia::vincular($recorrencia, $dados['transacao_ids']);
        } catch (\DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return RecorrenciaTransacaoResource::make($recorrencia->fresh())
            ->additional(['message' => "{$quantidade} lançamento(s) vinculado(s) à recorrência"]);
    }

    /**
     * Remove o vínculo de um lançamento com a recorrência (o lançamento continua existindo).
     */
    public function desvincularLancamento(RecorrenciaTransacao $recorrencia, Transacao $transacao)
    {
        if (Auth::id() !== $recorrencia->user_id || $transacao->user_id !== $recorrencia->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($transacao->recurring_transaction_id !== $recorrencia->id) {
            return response()->json(['message' => 'Este lançamento não pertence a esta recorrência'], 422);
        }

        VincularLancamentosRecorrencia::desvincular($recorrencia, $transacao);

        return response()->json(['message' => 'Vínculo removido com sucesso'], 200);
    }
}
