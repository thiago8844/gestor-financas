<?php

namespace App\Http\Controllers;

use App\Actions\Dashboard\ObterIndicadoresDashboardAction;
use Illuminate\Support\Facades\Auth;


class DashboardController extends Controller
{
    public function index()
    {

        $indicadoresMes = ObterIndicadoresDashboardAction::execute(Auth::id());
        

        return response()->json([
            'indicadores_mes' => $indicadoresMes
        ], 200);

    }
}
