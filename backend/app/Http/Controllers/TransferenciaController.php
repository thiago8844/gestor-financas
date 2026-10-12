<?php

namespace App\Http\Controllers;

use App\Actions\Transferencias\SalvarTransferencia;
use App\Http\Requests\TransferenciaRequest;
use App\Http\Resources\TransferenciaResource;
use App\Models\Transferencia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TransferenciaController extends Controller
{
    public function index(Request $request)
    {
        $query = Transferencia::with(['contaOrigem', 'contaDestino'])
            ->where('user_id', Auth::id());

        // Filtra pelas transferências que envolvem a conta, de qualquer um dos lados.
        if ($request->filled('conta_id')) {
            $query->where(function ($q) use ($request) {
                $q->where('from_account_id', $request->conta_id)
                    ->orWhere('to_account_id', $request->conta_id);
            });
        }

        if ($request->filled('data_inicial')) {
            $query->whereDate('date', '>=', $request->data_inicial);
        }

        if ($request->filled('data_final')) {
            $query->whereDate('date', '<=', $request->data_final);
        }

        $query->orderByDesc('date')->orderByDesc('id');

        // limit = 0 significa "todos": pagina com o total de registros.
        $limit = (int) $request->input('limit', 25);

        if ($limit <= 0) {
            $limit = max(1, (clone $query)->count());
        }

        return TransferenciaResource::collection($query->paginate($limit));
    }

    public function show(Transferencia $transferencia)
    {
        if ($transferencia->user_id !== Auth::id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        return TransferenciaResource::make($transferencia->load(['contaOrigem', 'contaDestino']));
    }

    public function store(TransferenciaRequest $request)
    {
        $transferencia = SalvarTransferencia::executar(Auth::id(), $request->validated());

        return TransferenciaResource::make($transferencia)
            ->additional(['message' => 'Transferência criada com sucesso'])
            ->response()
            ->setStatusCode(201);
    }

    public function update(TransferenciaRequest $request, Transferencia $transferencia)
    {
        if ($transferencia->user_id !== Auth::id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $transferencia = SalvarTransferencia::executar(Auth::id(), $request->validated(), $transferencia);

        return TransferenciaResource::make($transferencia)
            ->additional(['message' => 'Transferência atualizada com sucesso']);
    }

    public function destroy(Transferencia $transferencia)
    {
        if ($transferencia->user_id !== Auth::id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        // As duas transações saem junto (FK com cascade).
        $transferencia->delete();

        return response()->json(['message' => 'Transferência deletada com sucesso'], 200);
    }
}
