<?php

namespace App\Http\Controllers;

use App\Http\Requests\Relatorios\CenarioSimuladorRequest;
use App\Models\CenarioSimulador;
use Illuminate\Support\Facades\Auth;

class CenarioSimuladorController extends Controller
{
    public function index()
    {
        return response()->json([
            'data' => CenarioSimulador::where('user_id', Auth::id())->orderByDesc('updated_at')->get(),
        ]);
    }

    public function store(CenarioSimuladorRequest $request)
    {
        $cenario = CenarioSimulador::create(['user_id' => Auth::id(), ...$request->validated()]);

        return response()->json(['data' => $cenario], 201);
    }

    public function update(CenarioSimuladorRequest $request, CenarioSimulador $cenario)
    {
        abort_if($cenario->user_id !== Auth::id(), 404);

        $cenario->update($request->validated());

        return response()->json(['data' => $cenario]);
    }

    public function destroy(CenarioSimulador $cenario)
    {
        abort_if($cenario->user_id !== Auth::id(), 404);

        $cenario->delete();

        return response()->noContent();
    }
}
