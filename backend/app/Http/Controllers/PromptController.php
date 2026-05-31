<?php

namespace App\Http\Controllers;

use App\Actions\GerarPrompt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;

class PromptController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request)
    {

        Gate::authorize('use-ai-chatbot');

        $dadosFinanceiros = GerarPrompt::execute(Auth::user());

        return response()->json(['dados_financeiros' => $dadosFinanceiros], 200);
    }
}
