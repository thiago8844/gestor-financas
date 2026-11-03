<?php

namespace App\Http\Controllers;

use App\Actions\Faturas\AplicarRegraFechamentoCartao;
use App\Enums\RegraFechamentoCartao;
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
        $porDiasAntes = $request->input('closing_rule') === RegraFechamentoCartao::DIAS_ANTES_VENCIMENTO->value;

        $cartao = Cartao::create([
            'user_id' => Auth::id(),
            'account_id' => $request->account_id,
            'name' => $request->name,
            // Na regra "X dias antes do vencimento" o dia fixo não é usado; guarda o do vencimento.
            'closing_day' => $porDiasAntes ? $request->due_day : $request->closing_day,
            'closing_rule' => $request->input('closing_rule', RegraFechamentoCartao::DIA_FIXO->value),
            'closing_days_before_due' => $porDiasAntes ? $request->closing_days_before_due : null,
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

        $dados = $request->validated();
        $regra = $dados['closing_rule'] ?? $cartao->closing_rule?->value ?? RegraFechamentoCartao::DIA_FIXO->value;

        if ($regra === RegraFechamentoCartao::DIAS_ANTES_VENCIMENTO->value) {
            $dias = array_key_exists('closing_days_before_due', $dados) ? $dados['closing_days_before_due'] : $cartao->closing_days_before_due;

            if ($dias === null) {
                return response()->json(['message' => 'Informe quantos dias antes do vencimento a fatura fecha.'], 422);
            }

            $dados['closing_days_before_due'] = $dias;
            $dados['closing_day'] = $cartao->closing_day;
        } else {
            $dia = array_key_exists('closing_day', $dados) ? $dados['closing_day'] : $cartao->closing_day;
            $dados['closing_day'] = $dia ?? $cartao->closing_day;
            $dados['closing_days_before_due'] = null;
        }

        $dados['closing_rule'] = $regra;

        $cartao->fill($dados);
        $mudouFechamento = $cartao->isDirty(['due_day', 'closing_day', 'closing_rule', 'closing_days_before_due']);
        $cartao->save();

        $realocadas = $mudouFechamento ? AplicarRegraFechamentoCartao::executar($cartao) : 0;

        return CartaoResource::make($cartao->load('conta'))
            ->additional([
                'message' => $realocadas > 0
                    ? "Cartão atualizado. {$realocadas} despesa(s) foram realocadas entre as faturas."
                    : 'Cartão atualizado com sucesso',
            ]);
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
