<?php

namespace App\Actions\Dashboard;

use App\Actions\Faturas\ResolverFaturaCompra;
use App\Http\Resources\FaturaResource;
use App\Models\Cartao;
use App\Models\Fatura;
use Illuminate\Support\Facades\Auth;

class ObterFaturaAtualDashboardAction
{
    public const OFFSET_MAXIMO = 3;

    /**
     * Só mostra algo no dashboard quando o usuário tem exatamente 1 cartão cadastrado
     * (com mais de um, mostrar "a" fatura seria ambíguo). Com o cartão certo, mostra a
     * fatura do próximo vencimento (a mais urgente a pagar) — mesmo que ainda não tenha
     * nenhuma despesa lançada nela, caso em que ela aparece com R$ 0,00.
     *
     * $offset navega em ciclos de fechamento a partir dessa fatura-âncora: +1 é a fatura
     * seguinte, -1 a anterior, limitado a ±OFFSET_MAXIMO pra não precisar carregar/calcular
     * várias faturas de uma vez.
     */
    public static function execute(int $offset = 0): ?array
    {
        $userId = Auth::id();

        $cartoes = Cartao::where('user_id', $userId)->get();

        if ($cartoes->count() !== 1) {
            return null;
        }

        $cartao = $cartoes->first()->load('conta');
        $offset = max(-self::OFFSET_MAXIMO, min(self::OFFSET_MAXIMO, $offset));

        $cicloAncora = ResolverFaturaCompra::cicloDoProximoVencimento($cartao, now());
        $ciclo = $cicloAncora->copy()->addMonthsNoOverflow($offset);

        [$closingDate, $dueDate] = ResolverFaturaCompra::calcularDatas($cartao, $ciclo);
        $referenceMonth = $dueDate->copy()->startOfMonth();

        $fatura = Fatura::where('card_id', $cartao->id)
            ->whereDate('reference_month', $referenceMonth->toDateString())
            ->with(['parcelas' => fn ($query) => $query->with('categoria')->orderBy('purchase_date')->orderBy('id')])
            ->first();

        $dadosCartao = [
            'id' => $cartao->id,
            'name' => $cartao->name,
            'conta_nome' => $cartao->conta?->name,
        ];

        if ($fatura) {
            return [
                'cartao' => $dadosCartao,
                'fatura' => FaturaResource::make($fatura)->resolve(),
                'offset' => $offset,
            ];
        }

        // Ainda não existe nenhuma despesa lançada nessa fatura: mostra ela do jeito que vai
        // nascer (fechamento/vencimento já calculados), com valores zerados.
        return [
            'cartao' => $dadosCartao,
            'fatura' => [
                'id' => null,
                'card_id' => $cartao->id,
                'reference_month' => $referenceMonth->toDateString(),
                'closing_date' => $closingDate->toDateString(),
                'due_date' => $dueDate->toDateString(),
                'total' => 0.0,
                'pago' => 0.0,
                'pendente' => 0.0,
                'status' => now()->startOfDay()->gt($closingDate) ? 'FECHADA' : 'ABERTA',
                'parcelas' => [],
            ],
            'offset' => $offset,
        ];
    }
}
