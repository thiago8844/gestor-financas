<?php

namespace App\Http\Controllers;

use App\Actions\GerarPrompt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PromptController extends Controller
{
    /**
     * Handle the incoming request.
     */
    public function __invoke(Request $request)
    {

        $prompt = GerarPrompt::execute(Auth::user());

        return response()->json(['prompt' => $prompt], 200);
    }
}
