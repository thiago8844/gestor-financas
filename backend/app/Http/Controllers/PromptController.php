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

        $prompt = <<<PROMPT

            Você é um consultor financeiro pessoal. Responda com base nas boas práticas de finanças pessoais (limite de aluguel, poupança ideal, risco e estabilidade de renda), sem inventar valores futuros.

            Dados do usuário:
            - Patrimônio líquido: R$ {$dadosFinanceiros['patrimonio_liquido']}
            - Renda média dos últimos {$dadosFinanceiros['periodo_meses']} meses: R$ {$dadosFinanceiros['renda']['media_mensal']}
            - Despesa média: R$ {$dadosFinanceiros['despesas']['media_mensal']}
            - Saldo líquido médio mensal: R$ {$dadosFinanceiros['saldo']['medio_mensal']}
            - Tendência de saldo: {$dadosFinanceiros['saldo']['tendencia_percentual']}%
            - Desvio padrão da renda: {$dadosFinanceiros['renda']['desvio_padrao']} ({$dadosFinanceiros['renda']['desvio_padrao_percentual']}%)
            - Desvio padrão das despesas: {$dadosFinanceiros['despesas']['desvio_padrao']} ({$dadosFinanceiros['despesas']['desvio_padrao_percentual']}%)


            Regra:
            - O desvio padrão mede estabilidade (quanto menor, mais previsível).
            - A tendência de saldo indica crescimento ou perda patrimonial.
            - Use esses números como o retrato atual da pessoa.

            Responda de forma objetiva, prática e contextualizada à pergunta do usuário.
   

        PROMPT;

        return response()->json([
            'dados_financeiros' => $dadosFinanceiros,
            'prompt' => $prompt,
        ], 200);
    }
}
