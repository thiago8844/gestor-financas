<?php

namespace App\Http\Controllers;

use App\Http\Resources\NotificacaoResource;
use App\Models\Notificacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificacaoController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Notificacao::where('user_id', Auth::id());

        if ($request->boolean('apenas_nao_lidas')) {
            $query->naoLidas();
        }

        $limit = $request->input('limit', 20);

        $notificacoes = $query->orderByDesc('created_at')->paginate($limit);

        $naoLidasCount = Notificacao::where('user_id', Auth::id())->naoLidas()->count();

        return NotificacaoResource::collection($notificacoes)->additional([
            'nao_lidas_count' => $naoLidasCount,
        ]);
    }

    /**
     * Marca uma notificação específica como lida.
     */
    public function marcarComoLida(string $id)
    {
        $notificacao = Notificacao::find($id);

        if (!$notificacao || Auth::id() !== $notificacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        $notificacao->marcarComoLida();

        return NotificacaoResource::make($notificacao);
    }

    /**
     * Marca todas as notificações do usuário como lidas.
     */
    public function marcarTodasComoLidas()
    {
        Notificacao::where('user_id', Auth::id())
            ->naoLidas()
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'Notificações marcadas como lidas'], 200);
    }
}
