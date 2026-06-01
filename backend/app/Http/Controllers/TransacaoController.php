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
            ->where('is_initial_balance', false)
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
                    $query->whereRaw('DATE(COALESCE(date, due_date, created_at)) = DATE(?)', [now()->toDateString()]);
                    break;
                case "semana":
                    $query->whereRaw(
                        'DATE(COALESCE(date, due_date, created_at)) BETWEEN DATE(?) AND DATE(?)',
                        [now()->startOfWeek()->toDateString(), now()->endOfWeek()->toDateString()]
                    );
                    break;
                case "mes":
                    $startOfMonth = now()->startOfMonth()->toDateString();
                    $endOfMonth = now()->endOfMonth()->toDateString();
                    $query->whereRaw(
                        'DATE(COALESCE(date, due_date, created_at)) BETWEEN DATE(?) AND DATE(?)',
                        [$startOfMonth, $endOfMonth]
                    );
                    break;
                case "ano":
                    $startOfYear = now()->startOfYear()->toDateString();
                    $endOfYear = now()->endOfYear()->toDateString();
                    $query->whereRaw(
                        'DATE(COALESCE(date, due_date, created_at)) BETWEEN DATE(?) AND DATE(?)',
                        [$startOfYear, $endOfYear]
                    );
                    break;
            }
        }


        if ($request->filled('data_inicial') && $request->periodo === 'custom') {
            // $query->where('date', '>=', $request->data_inicial);
            $query->whereRaw('COALESCE(date, due_date, created_at) >= ?', [$request->data_inicial]);
        }

        if ($request->filled('data_final') && $request->periodo === 'custom') {
            //$query->where('date', '<=', $request->data_final);
            $query->whereRaw('COALESCE(date, due_date, created_at) <= ?', [$request->data_final]);
        }

        if ($request->filled('order_by')) {

            switch ($request->order_by) {
                case 'valor_asc':
                    $query->orderBy('amount', 'asc');
                    $query->orderByRaw('COALESCE(date, due_date, created_at) desc');
                    break;
                case 'valor_desc':
                    $query->orderBy('amount', 'desc');
                    $query->orderByRaw('COALESCE(date, due_date, created_at) desc');
                    break;
                case 'date_asc':
                    $query->orderByRaw('COALESCE(date, due_date, created_at) asc');
                    break;
                case 'date_desc':
                    $query->orderByRaw('COALESCE(date, due_date, created_at) desc');
                    break;
            }
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

        if($transacao->is_initial_balance){
            return response()->json(['message' => 'Não é permitido deletar a transação de saldo inicial'], 403);
        }   

        $transacao->delete();

        return response()->json(['message' => 'Transação deletada com sucesso'], 200);
    }
}
