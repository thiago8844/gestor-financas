<?php

namespace App\Http\Controllers;

use App\Http\Requests\ContaRequest;
use App\Http\Requests\StoreContaRequest;
use App\Http\Requests\UpdateContaRequest;
use App\Http\Resources\ContaResource;
use App\Models\Conta;
use App\Models\Transacao;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Sleep;

class ContaController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Conta::where('user_id', Auth::id());
        sleep(1.5);
        if($request->filled('active')) {
           $query->where('active', filter_var($request->active, FILTER_VALIDATE_BOOLEAN));     
        }

        if ($request->has('tipo')) {
            $query->where('type', $request->tipo);
        }

        if ($request->has('data_inicial')) {
            $query->whereDate('created_at', '>=', Carbon::parse($request->data_inicial));
        }

        if ($request->has('data_final')) {
            $query->whereDate('created_at', '<=', Carbon::parse($request->data_final));
        }

        $perPage = $request->input('per_page', 20);

        return response()->json($query->paginate($perPage));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreContaRequest $request)
    {
        DB::beginTransaction();

        try {

            $conta = Conta::create([
                'user_id' => Auth::id(),
                'name' => $request->name,
                'type' => $request->type,
                'role' => $request->role,
                'active' => $request->input('active', true),
                'include_in_networth' => $request->input('include_in_networth', true),
                'currency' => $request->currency,
                'instituicao' => $request->instituicao,
            ]);

            $saldoInicial = $request->input('saldo_inicial', 0);

            Transacao::create([
                'account_id' => $conta->id,
                'amount' => $saldoInicial,
                'type' => 'INCOME',
                'date' => $request->has('data_saldo_inicial') ? Carbon::parse($request->data_saldo_inicial) : now(),
                'description' => 'Saldo inicial da conta ' . $conta->name,
                'user_id' => $conta->user_id,
                'status' => 'PAID',
                'is_initial_balance' => true,
            ]);

            DB::commit();

            return response()->json(['message' => 'Conta criada com sucesso', 'conta' => $conta], 201);
        } catch (Exception $e) {
            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(Conta $conta)
    {

        if ($conta->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }


        return ContaResource::make($conta);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateContaRequest $request, Conta $conta)
    {

        if ($conta->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }

        DB::beginTransaction();

        try {

            $contaRequest = $request->all();
            unset($contaRequest['saldo_inicial']);

            $conta->update($request->validated());

            if ($request->has('saldo_inicial')) {
                $updateData = ['amount' => $request->saldo_inicial];

                if ($request->has('data_saldo_inicial')) {
                    $updateData['date'] = Carbon::parse($request->data_saldo_inicial);
                }

                Transacao::where('account_id', $conta->id)
                    ->where('is_initial_balance', true)
                    ->update($updateData);
            }

            DB::commit();
            return response()->json([], 204);
        } catch (Exception  $e) {

            DB::rollBack();
            return response()->json(['message' => $e->getMessage()], 500);
        }
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Conta $conta)
    {

        if ($conta->user_id !== Auth::id()) {
            return response()->json(['message' => 'Ação não autorizada'], 403);
        }


        $conta->delete();
        return response()->json(['message' => 'Conta deletada com sucesso'], 200);
    }
}
