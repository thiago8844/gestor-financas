<?php

namespace App\Support\Push;

use App\Models\Notificacao;
use App\Models\PushSubscription;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/**
 * Envia uma Notificacao como Web Push para todos os dispositivos inscritos do usuário.
 * Falha de envio nunca propaga: o push é um extra, a notificação já está salva no app.
 */
class EnviadorPush
{
    public function ativo(): bool
    {
        return filled(config('webpush.vapid.public_key')) && filled(config('webpush.vapid.private_key'));
    }

    public function enviar(Notificacao $notificacao): void
    {
        if (!$this->ativo()) {
            return;
        }

        $inscricoes = PushSubscription::where('user_id', $notificacao->user_id)->get();

        if ($inscricoes->isEmpty()) {
            return;
        }

        try {
            $webPush = new WebPush(['VAPID' => [
                'subject' => config('webpush.vapid.subject'),
                'publicKey' => config('webpush.vapid.public_key'),
                'privateKey' => config('webpush.vapid.private_key'),
            ]]);

            $payload = json_encode([
                'id' => $notificacao->id,
                'title' => $notificacao->title,
                'body' => $notificacao->message,
                'url' => $notificacao->action_url ?: '/',
                'tag' => $notificacao->type,
                'severity' => $notificacao->severity,
            ], JSON_UNESCAPED_UNICODE);

            $porEndpoint = [];

            foreach ($inscricoes as $inscricao) {
                $porEndpoint[$inscricao->endpoint] = $inscricao;

                $webPush->queueNotification(Subscription::create([
                    'endpoint' => $inscricao->endpoint,
                    'publicKey' => $inscricao->public_key,
                    'authToken' => $inscricao->auth_token,
                    'contentEncoding' => $inscricao->content_encoding,
                ]), $payload);
            }

            foreach ($webPush->flush() as $relatorio) {
                // 404/410: o dispositivo cancelou ou a inscrição expirou.
                if ($relatorio->isSubscriptionExpired()) {
                    $porEndpoint[$relatorio->getEndpoint()]?->delete();
                } elseif (!$relatorio->isSuccess()) {
                    Log::warning('Falha ao enviar push', ['motivo' => $relatorio->getReason()]);
                }
            }
        } catch (Throwable $e) {
            Log::warning('Erro ao enviar push', ['erro' => $e->getMessage()]);
        }
    }
}
