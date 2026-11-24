<?php

return [
    /*
     * Chaves VAPID do Web Push (gere com `php artisan webpush:gerar-chaves`).
     * Sem as chaves, o envio de push fica desligado e o resto do app segue normal.
     */
    'vapid' => [
        'subject' => env('VAPID_SUBJECT', env('APP_URL', 'mailto:contato@example.com')),
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
    ],
];
