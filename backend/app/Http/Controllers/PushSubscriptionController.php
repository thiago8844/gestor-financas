<?php

namespace App\Http\Controllers;

use App\Models\PushSubscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class PushSubscriptionController extends Controller
{
    public function chavePublica(): JsonResponse
    {
        return response()->json(['public_key' => config('webpush.vapid.public_key')]);
    }

    public function store(Request $request): JsonResponse
    {
        $dados = $request->validate([
            'endpoint' => ['required', 'url', 'max:2000'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'content_encoding' => ['nullable', 'in:aesgcm,aes128gcm'],
        ]);

        PushSubscription::updateOrCreate(
            ['user_id' => Auth::id(), 'endpoint_hash' => hash('sha256', $dados['endpoint'])],
            [
                'endpoint' => $dados['endpoint'],
                'public_key' => $dados['keys']['p256dh'],
                'auth_token' => $dados['keys']['auth'],
                'content_encoding' => $dados['content_encoding'] ?? 'aes128gcm',
                'user_agent' => substr((string) $request->userAgent(), 0, 255),
            ]
        );

        return response()->json(['message' => 'Notificações ativadas neste dispositivo.'], 201);
    }

    public function destroy(Request $request): JsonResponse
    {
        $dados = $request->validate(['endpoint' => ['required', 'string']]);

        PushSubscription::where('user_id', Auth::id())
            ->where('endpoint_hash', hash('sha256', $dados['endpoint']))
            ->delete();

        return response()->json(['message' => 'Notificações desativadas neste dispositivo.']);
    }
}
