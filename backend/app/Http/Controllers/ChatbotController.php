<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Http;

class ChatbotController extends Controller
{

  public function chat(Request $request)
  {

    $user = Auth::user();

    Gate::authorize('use-ai-chatbot');
    $data = $request->validate([
      'message' => ['required', 'string', 'max:300'],
      'dados_financeiros' => ['required', 'array'],
      'history' => ['nullable', 'array'],
    ]);

    $systemPrompt =  <<<PROMPT
        Você é um consultor financeiro pessoal dentro de um app de gestão de finanças.

        Sua função é responder perguntas do usuário com base nos dados financeiros enviados.

        Use boas práticas de finanças pessoais, como:
        - controle de despesas;
        - limite saudável de aluguel;
        - reserva de emergência;
        - poupança mensal;
        - estabilidade de renda;
        - evolução patrimonial;
        - risco financeiro.

        Regras:
        - Responda em português do Brasil.
        - Seja objetivo, prático e contextualizado.
        - Não invente dados que não foram enviados.
        - Não invente previsões futuras.
        - Use os dados financeiros como o retrato atual do usuário.
        - O desvio padrão mede estabilidade: quanto menor, mais previsível.
        - A tendência de saldo indica crescimento ou perda patrimonial.
        - Se a pergunta for muito aberta, dê uma análise curta com os principais pontos.
      PROMPT;

    $userContent = [
      'pergunta_do_usuario' => $data['message'],
      'dados_financeiros' => $data['dados_financeiros'],
    ];

    $history = collect($data['history'] ?? [])
      ->filter(function ($message) {
        return isset($message['role'], $message['content'])
          && in_array($message['role'], ['user', 'assistant'], true)
          && is_string($message['content']);
      })
      ->map(function ($message) {
        return [
          'role' => $message['role'],
          'content' => $message['content'],
        ];
      })
      ->values()
      ->toArray();

    $input = array_merge(
      [
        [
          'role' => 'system',
          'content' => $systemPrompt,
        ],
        [
          'role' => 'user',
          'content' => json_encode([
            'tipo' => 'dados_financeiros_atuais',
            'dados_financeiros' => $data['dados_financeiros'],
          ], JSON_UNESCAPED_UNICODE),
        ],
      ],
      $history,
      [
        [
          'role' => 'user',
          'content' => $data['message'],
        ],
      ]
    );

    $response = Http::withToken(env('OPENAI_API_KEY'))
      ->timeout(60)
      ->post(env('OPENAI_API_URL'), [
        'model' => 'gpt-4.1-nano',
        'input' => $input,
        'max_output_tokens' => 1024,
      ]);

    if ($response->failed()) {
      return response()->json([
        'message' => 'Erro ao consultar o assistente de IA.',
        'error' => $response->json(),
      ], 500);
    }

    $json = $response->json();

    // Status incompleto (ex: max_output_tokens estourado, content filter, etc.)
    if (($json['status'] ?? null) === 'incomplete') {
      $reason = $json['incomplete_details']['reason'] ?? 'desconhecido';
      return response()->json([
        'message' => "A resposta foi cortada pelo modelo (motivo: {$reason}). Tente uma pergunta mais curta.",
      ], 500);
    }

    // Extrai o primeiro bloco de texto do output
    $outputMessage = collect($json['output'] ?? [])->firstWhere('type', 'message');
    $answer = $outputMessage['content'][0]['text'] ?? null;

    if (!$answer) {
      return response()->json([
        'message' => 'O assistente não retornou uma resposta válida. Tente novamente.',
      ], 500);
    }

    return response()->json([
      'reply' => $answer,
    ]);
  }

  public function permission()
  {
    $user = Auth::user();

    Gate::authorize('use-ai-chatbot');

    return response()->json([
      'message' => 'Você tem permissão para usar o assistente de IA.'
    ], 200);
  }
}
