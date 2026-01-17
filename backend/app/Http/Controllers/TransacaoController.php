<?php

namespace App\Http\Controllers;

use App\Enums\TransactionStatus;
use App\Http\Requests\TransacaoRequest;
use App\Http\Resources\TransacaoResource;
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

        $query = Transacao::with(['categoria', 'conta'])
            ->where('user_id', Auth::id());

        if ($request->filled('categoria_id')) {
            $query->where('category_id', $request->categoria_id);
        }

        if ($request->filled('conta_id')) {
            $query->where('account_id', $request->conta_id);
        }

        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

        if ($request->filled('periodo')) {
            switch ($request->periodo) {
                case 'hoje':
                    $query->whereDate('date', now()->toDateString());
                    break;
                case "semana":
                    $query->whereBetween('date', [now()->startOfWeek(), now()->endOfWeek()]);
                    break;
                case "mes":
                    $query->whereMonth('date', now()->month)
                        ->whereYear('date', now()->year);
                    break;
                case "ano":
                    $query->whereYear('date', now()->year);
                    break;
            }
        }


        if ($request->filled('data_inicial') && $request->periodo === 'custom') {
            $query->where('date', '>=', $request->data_inicial);
        }

        if ($request->filled('order_by')) {

            switch ($request->order_by) {
                case 'valor_asc':
                    $query->orderBy('amount', 'asc');
                    break;
                case 'valor_desc':
                    $query->orderBy('amount', 'desc');
                    break;
                case 'date_asc':
                    $query->orderBy('date', 'asc');
                    break;
                case 'date_desc':
                    $query->orderBy('date', 'desc');
                    break;
            }
        }

        if ($request->filled('data_final') && $request->periodo === 'custom') {
            $query->where('date', '<=', $request->data_final);
        }

        $limit = $request->input('limit', 25);

        $transacoes = $query->paginate($limit);
        $total = $transacoes->sum('amount');

        return TransacaoResource::collection($transacoes)->additional([
            'total' => $total
        ]);
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
     * Display the specified resource.
     */
    public function show(string $id)
    {

        $transacao = Transacao::with('categoria')->find($id);

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

        if (Auth::id() !== $transacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $transacao->update([
            ...$request->all(),
        ]);

        return response()->json(['message' => 'Transação atualizada com sucesso'], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Transacao $transacao)
    {

        if (Auth::id() !== $transacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $transacao->delete();

        return response()->json(['message' => 'Transação deletada com sucesso'], 200);
    }
}
