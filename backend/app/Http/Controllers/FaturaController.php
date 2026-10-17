<?php

namespace App\Http\Controllers;

use App\Actions\Faturas\Exceptions\OperacaoFaturaException;
use App\Actions\Faturas\LancarNaFatura;
use App\Actions\Faturas\PagarFatura;
use App\Actions\Faturas\ReverterPagamentoFatura;
use App\Http\Resources\AuditoriaFaturaResource;
use App\Http\Resources\FaturaResource;
use App\Models\AuditoriaFatura;
use App\Models\Cartao;
use App\Models\Categoria;
use App\Models\Fatura;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

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
            ->with([
                'parcelas' => function ($query) {
                    $query->with('categoria')->orderBy('purchase_date')->orderBy('id');
                },
                'auditorias',
            ])
            ->orderByDesc('reference_month')
            ->get();

        return FaturaResource::collection($faturas);
    }

    /**
     * Paga a fatura na data informada. Sem `amount` (ou com o valor pendente inteiro), é o pagamento
     * total de sempre; com um valor menor, é pagamento parcial e o restante vai para a próxima fatura.
     */
    public function pagar(Request $request, Fatura $fatura)
    {
        if ($fatura->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $request->validate([
            'date' => ['nullable', 'date'],
            'amount' => ['nullable', 'numeric', 'min:0', 'max:999999999.99'],
        ]);

        $dataPagamento = $request->filled('date') ? Carbon::parse($request->date) : Carbon::now();

        try {
            $levado = PagarFatura::executar(
                $fatura,
                $dataPagamento,
                $request->filled('amount') ? (float) $request->amount : null
            );
        } catch (OperacaoFaturaException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $mensagem = $levado > 0
            ? 'Pagamento parcial registrado. R$ ' . number_format($levado, 2, ',', '.') . ' foram levados para a próxima fatura.'
            : 'Fatura paga com sucesso';

        return FaturaResource::make($this->carregar($fatura))->additional(['message' => $mensagem]);
    }

    /**
     * Reverte o pagamento da fatura: volta todas as parcelas pagas dela para pendente (e desfaz a
     * rolagem do pagamento parcial, se houver), caso o usuário tenha se confundido ao pagar.
     */
    public function reverter(Fatura $fatura)
    {
        if ($fatura->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        try {
            ReverterPagamentoFatura::executar($fatura);
        } catch (OperacaoFaturaException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return FaturaResource::make($this->carregar($fatura))
            ->additional(['message' => 'Pagamento da fatura revertido com sucesso']);
    }

    /**
     * Lança uma despesa ou um crédito (estorno/ajuste) direto nesta fatura.
     */
    public function lancar(Request $request, Fatura $fatura)
    {
        if ($fatura->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $dados = $request->validate([
            'type' => ['required', Rule::in(['EXPENSE', 'INCOME'])],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999.99'],
            'description' => ['required', 'string', 'max:255'],
            'purchase_date' => ['nullable', 'date'],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->where('user_id', Auth::id())],
            'category_name' => ['nullable', 'string', 'max:100'],
            'budget_id' => ['nullable', 'integer', Rule::exists('budgets', 'id')->where('user_id', Auth::id())],
        ], [
            'type.in' => 'Escolha entre despesa ou crédito.',
            'amount.required' => 'O valor é obrigatório.',
            'amount.min' => 'O valor deve ser maior que zero.',
            'description.required' => 'A descrição é obrigatória.',
        ]);

        if (empty($dados['category_id']) && !empty($dados['category_name'])) {
            $dados['category_id'] = Categoria::firstOrCreate(
                ['user_id' => Auth::id(), 'name' => $dados['category_name']]
            )->id;
        }

        LancarNaFatura::executar($fatura, $dados);

        return FaturaResource::make($this->carregar($fatura))
            ->additional(['message' => $dados['type'] === 'INCOME' ? 'Crédito lançado na fatura' : 'Despesa lançada na fatura'])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Histórico de auditorias da fatura (a mais recente primeiro).
     */
    public function auditorias(Fatura $fatura)
    {
        if ($fatura->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $totalAtual = $fatura->resumoValores()['total'];

        return response()->json([
            'data' => $fatura->auditorias()->orderByDesc('id')->get()
                ->map(fn (AuditoriaFatura $a) => AuditoriaFaturaResource::make($a)->comTotalAtual($totalAtual)->resolve())
                ->values(),
        ]);
    }

    /**
     * Registra a auditoria manual: o usuário conferiu a fatura do banco (PDF/planilha) e informa o
     * total que o banco cobrou. O app só compara e sinaliza a diferença.
     */
    public function auditar(Request $request, Fatura $fatura)
    {
        if ($fatura->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        $dados = $request->validate([
            'bank_total' => ['required', 'numeric', 'min:-999999999.99', 'max:999999999.99'],
            'note' => ['nullable', 'string', 'max:2000'],
        ], [
            'bank_total.required' => 'Informe o total da fatura segundo o banco.',
        ]);

        $totalApp = $fatura->resumoValores()['total'];

        $auditoria = AuditoriaFatura::create([
            'user_id' => $fatura->user_id,
            'invoice_id' => $fatura->id,
            'bank_total' => round((float) $dados['bank_total'], 2),
            'app_total' => $totalApp,
            'difference' => round((float) $dados['bank_total'] - $totalApp, 2),
            'note' => $dados['note'] ?? null,
        ]);

        $diferenca = (float) $auditoria->difference;

        return AuditoriaFaturaResource::make($auditoria)
            ->comTotalAtual($totalApp)
            ->additional([
                'message' => abs($diferenca) < 0.005
                    ? 'Auditoria registrada: a fatura do app confere com a do banco.'
                    : 'Auditoria registrada com diferença de R$ ' . number_format(abs($diferenca), 2, ',', '.') . '.',
            ])
            ->response()
            ->setStatusCode(201);
    }

    private function carregar(Fatura $fatura): Fatura
    {
        return $fatura->load([
            'parcelas' => fn ($query) => $query->with('categoria')->orderBy('purchase_date')->orderBy('id'),
            'auditorias',
        ]);
    }
}
