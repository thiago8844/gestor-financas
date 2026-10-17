<?php

namespace App\Http\Controllers;

use App\Actions\Cartoes\CriarDespesaCartao;
use App\Actions\CriarTransacaoParcelada;
use App\Enums\TransactionStatus;
use App\Http\Requests\AtualizarValorTransacaoRequest;
use App\Http\Requests\TransacaoCartaoRequest;
use App\Http\Requests\TransacaoParceladaRequest;
use App\Http\Requests\TransacaoRequest;
use App\Http\Resources\TransacaoResource;
use App\Models\Cartao;
use App\Models\Categoria;
use App\Models\Transacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class TransacaoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {

        $query = Transacao::with(['categoria', 'conta', 'cartao', 'fatura'])
            ->where('is_initial_balance', false)
            // Transferências têm tela própria; aqui só entram receitas e despesas de verdade.
            ->whereNull('transfer_id')
            ->where('user_id', Auth::id());

        if ($request->filled('categoria_id')) {
            $query->where('category_id', $request->categoria_id);
        }

        if ($request->filled('conta_id')) {
            $query->where('account_id', $request->conta_id);
        }

        if ($request->filled('cartao_id')) {
            $query->where('card_id', $request->cartao_id);
        }

        if (in_array($request->status, ['PENDING', 'PAID'], true)) {
            $query->where('status', $request->status);
        }

        // Origem do lançamento: "conta" = débito/dinheiro direto na conta, "cartao" = compras no cartão.
        if ($request->origem === 'cartao') {
            $query->whereNotNull('card_id');
        } elseif ($request->origem === 'conta') {
            $query->whereNull('card_id');
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('descricao')) {
            $query->where('description', 'like', '%' . $request->descricao . '%');
        }

        if ($request->boolean('apenas_parceladas')) {
            $query->whereNotNull('installment_group');
        }

        if ($request->filled('installment_group')) {
            $query->where('installment_group', $request->installment_group);
        }

        // Coluna de data usada no filtro de período e na ordenação por data.
        // Sem escolha, mantém o comportamento antigo (data > vencimento > cadastro).
        $campoData = match ($request->input('campo_data')) {
            'date' => 'date',
            'purchase_date' => 'purchase_date',
            'due_date' => 'due_date',
            'created_at' => 'created_at',
            default => 'COALESCE(date, due_date, created_at)',
        };

        if ($request->filled('periodo')) {
            $intervalo = match ($request->periodo) {
                'hoje' => [now()->toDateString(), now()->toDateString()],
                'semana' => [now()->startOfWeek()->toDateString(), now()->endOfWeek()->toDateString()],
                'mes' => [now()->startOfMonth()->toDateString(), now()->endOfMonth()->toDateString()],
                'ano' => [now()->startOfYear()->toDateString(), now()->endOfYear()->toDateString()],
                default => null,
            };

            if ($intervalo) {
                $query->whereRaw("DATE({$campoData}) BETWEEN DATE(?) AND DATE(?)", $intervalo);
            }
        }

        if ($request->filled('data_inicial') && $request->periodo === 'custom') {
            $query->whereRaw("DATE({$campoData}) >= DATE(?)", [$request->data_inicial]);
        }

        if ($request->filled('data_final') && $request->periodo === 'custom') {
            $query->whereRaw("DATE({$campoData}) <= DATE(?)", [$request->data_final]);
        }

        if ($request->filled('order_by')) {
            switch ($request->order_by) {
                case 'valor_asc':
                    $query->orderBy('amount', 'asc');
                    $query->orderByRaw("{$campoData} desc");
                    break;
                case 'valor_desc':
                    $query->orderBy('amount', 'desc');
                    $query->orderByRaw("{$campoData} desc");
                    break;
                case 'date_asc':
                    $query->orderByRaw("{$campoData} asc");
                    break;
                case 'date_desc':
                    $query->orderByRaw("{$campoData} desc");
                    break;
            }
        }

        $limit = (int) $request->input('limit', 25);

        // limit = 0 significa "todos": pagina com o total de registros.
        if ($limit <= 0) {
            $limit = max(1, (clone $query)->count());
        }

        $transacoes = $query->paginate($limit);
        $total = $transacoes->sum('amount');

        return TransacaoResource::collection($transacoes)->additional([
            'total' => $total
        ]);
    }

    /**
     * Lista os grupos de parcelamento do usuário (para preencher o filtro de compras/receitas compostas).
     */
    public function gruposParcelados(Request $request)
    {
        $query = Transacao::where('user_id', Auth::id())
            ->whereNotNull('installment_group');

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        $grupos = $query
            ->selectRaw('installment_group, description, installment_total, MIN(COALESCE(date, due_date, created_at)) as primeira_data')
            ->groupBy('installment_group', 'description', 'installment_total')
            ->orderByDesc('primeira_data')
            ->get();

        return response()->json(['data' => $grupos]);
    }


    /**
     * Store a newly created resource in storage.
     */
    public function store(TransacaoRequest $request)
    {
        if (!$request->filled('category_id') && $request->filled('category_name')) {
            //Verificar se não existe um categori acom o mesmo nome por coincidência que o burrão não clicou no automcomplete
            $novaCategoria = Categoria::where('user_id', Auth::id())
                ->where('name', $request->category_name)
                ->first();

            if (!$novaCategoria) {
                $novaCategoria = Categoria::create([
                    'user_id' => Auth::id(),
                    'name' => $request->category_name,
                ]);
            }

            $request->merge(['category_id' => $novaCategoria->id]);
        }

        Transacao::create([
            'user_id' => Auth::id(),
            'status' => $request->input('paid') ? TransactionStatus::PAID : TransactionStatus::PENDING,
            ...$request->all()
        ]);

        return response()->json(['message' => 'Transação criada com sucesso'], 201);
    }

    /**
     * Store a new set of installment transactions (compra parcelada).
     */
    public function storeParcelado(TransacaoParceladaRequest $request)
    {
        $dados = $request->all();

        if (!$request->filled('category_id') && $request->filled('category_name')) {
            $categoria = Categoria::where('user_id', Auth::id())
                ->where('name', $request->category_name)
                ->first();

            if (!$categoria) {
                $categoria = Categoria::create([
                    'user_id' => Auth::id(),
                    'name' => $request->category_name,
                ]);
            }

            $dados['category_id'] = $categoria->id;
        }

        $installmentGroup = CriarTransacaoParcelada::executar(Auth::id(), $dados);

        return response()->json([
            'message' => 'Transação parcelada criada com sucesso',
            'installment_group' => $installmentGroup,
        ], 201);
    }



    /**
     * Store one or more expense transactions (single or parceladas) linked to a card, grouped into faturas.
     */
    public function storeCartao(TransacaoCartaoRequest $request)
    {
        $cartao = Cartao::where('id', $request->card_id)
            ->where('user_id', Auth::id())
            ->firstOrFail();

        $dados = $request->all();

        if (!$request->filled('category_id') && $request->filled('category_name')) {
            $categoria = Categoria::where('user_id', Auth::id())
                ->where('name', $request->category_name)
                ->first();

            if (!$categoria) {
                $categoria = Categoria::create([
                    'user_id' => Auth::id(),
                    'name' => $request->category_name,
                ]);
            }

            $dados['category_id'] = $categoria->id;
        }

        $resultado = CriarDespesaCartao::executar(Auth::id(), $cartao, $dados);

        return response()->json([
            'message' => 'Despesa do cartão criada com sucesso',
            'installment_group' => $resultado['installment_group'],
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {

        $transacao = Transacao::with(['categoria', 'conta', 'cartao', 'fatura'])->find($id);

        if (Auth::id() !== $transacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        return TransacaoResource::make($transacao);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(TransacaoRequest $request, string $id)
    {
        $transacao = Transacao::find($id);

        if (Auth::id() !== $transacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($transacao->transfer_id !== null) {
            return response()->json(['message' => $this->mensagemMovimentacaoInterna($transacao, 'Edite')], 403);
        }

        // Despesa de cartão: pertence a um grupo de parcelas/fatura, então só o valor pode
        // mudar por aqui. Pra alterar outra coisa, o fluxo é excluir e recriar (ver rota
        // dedicada /transacoes/{id}/valor, usada pela tela de edição pra esse caso).
        if ($transacao->card_id !== null) {
            $transacao->update(['amount' => $request->amount]);

            return response()->json(['message' => 'Transação atualizada com sucesso'], 200);
        }

        //Colocar essa lógica em um método terceirizado
        if (!$request->filled('category_id') && $request->filled('category_name')) {
            //Verificar se não existe um categori acom o mesmo nome por coincidência que o burrão não clicou no automcomplete
            $novaCategoria = Categoria::where('user_id', Auth::id())
                ->where('name', $request->category_name)
                ->first();

            if (!$novaCategoria) {
                $novaCategoria = Categoria::create([
                    'user_id' => Auth::id(),
                    'name' => $request->category_name,
                ]);
            }

            $request->merge(['category_id' => $novaCategoria->id]);
        }

        $transacao->update([
            ...$request->except(['installment_number', 'installment_total', 'installment_group']),
        ]);

        return response()->json(['message' => 'Transação atualizada com sucesso'], 200);
    }

    /**
     * Atualiza só o valor de uma despesa. Usado pela tela de edição para despesas de cartão,
     * cujos demais campos (conta, vencimento, categoria etc.) pertencem ao grupo/fatura e não
     * podem ser editados individualmente.
     */
    public function atualizarValor(AtualizarValorTransacaoRequest $request, Transacao $transacao)
    {
        if (Auth::id() !== $transacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($transacao->transfer_id !== null) {
            return response()->json(['message' => $this->mensagemMovimentacaoInterna($transacao, 'Edite')], 403);
        }

        $transacao->update(['amount' => $request->amount]);

        return response()->json(['message' => 'Valor atualizado com sucesso'], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Transacao $transacao)
    {

        if (Auth::id() !== $transacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($transacao->transfer_id !== null) {
            return response()->json(['message' => $this->mensagemMovimentacaoInterna($transacao, 'Exclua')], 403);
        }

        if($transacao->is_initial_balance){
            return response()->json(['message' => 'Não é permitido deletar a transação de saldo inicial'], 403);
        }   

        $transacao->delete();

        return response()->json(['message' => 'Transação deletada com sucesso'], 200);
    }

    /**
     * Remove multiple resources from storage at once.
     */
    public function destroyMultiplas(Request $request)
    {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
        ]);

        $excluidas = Transacao::whereIn('id', $request->input('ids'))
            ->where('user_id', Auth::id())
            ->where('is_initial_balance', false)
            ->whereNull('transfer_id')
            ->delete();

        return response()->json([
            'message' => 'Transações deletadas com sucesso',
            'excluidas' => $excluidas,
        ], 200);
    }

    /**
     * Lançamentos com transfer_id são movimentação interna: transferência entre contas ou a rolagem
     * de saldo do pagamento parcial de fatura. Nenhum dos dois se altera direto por aqui.
     */
    private function mensagemMovimentacaoInterna(Transacao $transacao, string $verbo): string
    {
        if ($transacao->isRolagemDeFatura()) {
            return 'Este lançamento é o saldo de um pagamento parcial de fatura. Para desfazê-lo, reverta o pagamento da fatura.';
        }

        return "{$verbo} esta movimentação pela tela de transferências";
    }
}
