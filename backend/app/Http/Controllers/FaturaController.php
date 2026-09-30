<?php

namespace App\Http\Controllers;

use App\Enums\TransactionStatus;
use App\Http\Resources\FaturaResource;
use App\Models\Cartao;
use App\Models\Fatura;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FaturaController extends Controller
{
    /**
     * Lista as faturas de um cartão, da mais recente para a mais antiga, com as despesas de cada uma.
     */
    public function porCartao(Cartao $cartao)
    {
        if ($cartao->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $faturas = Fatura::where('card_id', $cartao->id)
            ->with(['parcelas' => function ($query) {
                $query->with('categoria')->orderBy('purchase_date')->orderBy('id');
            }])
            ->orderByDesc('reference_month')
            ->get();

        return FaturaResource::collection($faturas);
    }

    /**
     * Paga uma fatura integralmente: marca todas as parcelas pendentes como pagas na data informada.
     * A conta debitada é sempre a vinculada ao cartão (já é a account_id de cada parcela).
     */
    public function pagar(Request $request, Fatura $fatura)
    {
        if ($fatura->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $request->validate([
            'date' => ['nullable', 'date'],
        ]);

        $dataPagamento = $request->filled('date') ? Carbon::parse($request->date) : Carbon::now();

        $pendentes = Transacao::where('invoice_id', $fatura->id)
            ->where('status', TransactionStatus::PENDING);

        if ($pendentes->count() === 0) {
            return response()->json(['message' => 'Essa fatura já está paga.'], 422);
        }

        $pendentes->update([
            'status' => TransactionStatus::PAID,
            'date' => $dataPagamento->toDateTimeString(),
        ]);

        return FaturaResource::make(
            $fatura->load(['parcelas' => fn ($query) => $query->with('categoria')->orderBy('purchase_date')->orderBy('id')])
        )->additional(['message' => 'Fatura paga com sucesso']);
    }

    /**
     * Reverte o pagamento da fatura: volta todas as parcelas pagas dela para pendente,
     * caso o usuário tenha se confundido ao pagar.
     */
    public function reverter(Fatura $fatura)
    {
        if ($fatura->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $pagas = Transacao::where('invoice_id', $fatura->id)
            ->where('status', TransactionStatus::PAID);

        if ($pagas->count() === 0) {
            return response()->json(['message' => 'Essa fatura não tem nenhum pagamento para reverter.'], 422);
        }

        $pagas->update([
            'status' => TransactionStatus::PENDING,
            'date' => null,
        ]);

        return FaturaResource::make(
            $fatura->load(['parcelas' => fn ($query) => $query->with('categoria')->orderBy('purchase_date')->orderBy('id')])
        )->additional(['message' => 'Pagamento da fatura revertido com sucesso']);
    }
}
