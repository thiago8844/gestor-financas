<?php

namespace App\Actions\Notificacoes;

use App\Models\Notificacao;
use App\Models\User;
use App\Notificacoes\RegraNotificacao;

class GerarNotificacoes
{
    public function executar(): int
    {
        $regras = collect(config('notificacoes.regras'))
            ->map(fn (string $classe) => app($classe))
            ->filter(fn ($regra) => $regra instanceof RegraNotificacao);

        $criadas = 0;

        User::query()->select('id')->chunk(200, function ($usuarios) use ($regras, &$criadas) {
            foreach ($usuarios as $usuario) {
                foreach ($regras as $regra) {
                    foreach ($regra->verificar($usuario) as $item) {
                        $notificacao = Notificacao::firstOrCreate(
                            [
                                'user_id' => $usuario->id,
                                'dedupe_key' => $item['dedupe_key'],
                            ],
                            [
                                'type' => $regra->tipo(),
                                'title' => $item['title'],
                                'message' => $item['message'],
                                'severity' => $item['severity'] ?? 'warning',
                                'data' => $item['data'] ?? null,
                                'action_url' => $item['action_url'] ?? null,
                            ]
                        );

                        if ($notificacao->wasRecentlyCreated) {
                            $criadas++;
                        }
                    }
                }
            }
        });

        return $criadas;
    }
}
