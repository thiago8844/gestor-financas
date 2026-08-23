<?php

namespace App\Notificacoes;

use App\Models\User;

interface RegraNotificacao
{
    /**
     * Chave curta que identifica o tipo de notificação (ex.: "fatura_vencida").
     */
    public function tipo(): string;

    /**
     * Verifica a situação do usuário e retorna as notificações que deveriam existir agora.
     *
     * Cada item deve trazer uma `dedupe_key` única (por usuário) para evitar duplicar
     * a mesma notificação a cada execução do job.
     *
     * @return array<int, array{
     *     title: string,
     *     message: string,
     *     dedupe_key: string,
     *     severity?: string,
     *     data?: array,
     *     action_url?: string,
     * }>
     */
    public function verificar(User $user): array;
}
