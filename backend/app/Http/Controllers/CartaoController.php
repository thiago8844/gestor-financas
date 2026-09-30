<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreCartaoRequest;
use App\Http\Requests\UpdateCartaoRequest;
use App\Http\Resources\CartaoResource;
use App\Models\Cartao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CartaoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Cartao::with('conta')->where('user_id', Auth::id());

        if ($request->filled('active')) {
            $query->where('active', filter_var($request->active, FILTER_VALIDATE_BOOLEAN));
        }

        if ($request->filled('account_id')) {
            $query->where('account_id', $request->account_id);
        }

        $perPage = $request->input('per_page', 20);

        return CartaoResource::collection($query->orderBy('name')->paginate($perPage));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreCartaoRequest $request)
    {
        $cartao = Cartao::create([
            'user_id' => Auth::id(),
            'account_id' => $request->account_id,
            'name' => $request->name,
            'closing_day' => $request->closing_day,
            'due_day' => $request->due_day,
            'active' => $request->input('active', true),
        ]);

        return CartaoResource::make($cartao->load('conta'))
            ->additional(['message' => 'Cartão criado com sucesso'])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Display the specified resource.
     */
    public function show(Cartao $cartao)
    {
        if ($cartao->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        return CartaoResource::make($cartao->load('conta'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateCartaoRequest $request, Cartao $cartao)
    {
        if ($cartao->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $cartao->update($request->validated());

        return CartaoResource::make($cartao->load('conta'))
            ->additional(['message' => 'Cartão atualizado com sucesso']);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Cartao $cartao)
    {
        if ($cartao->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        if ($cartao->recorrencias()->exists()) {
            return response()->json([
                'message' => 'Esse cartão tem recorrências vinculadas. Exclua ou mude a origem delas antes de excluir o cartão.',
            ], 422);
        }

        $cartao->delete();

        return response()->json(['message' => 'Cartão deletado com sucesso'], 200);
    }
}
