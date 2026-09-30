<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ConfiguracaoUsuario extends Model
{
    public const DIAS_MAXIMO = 7;

    protected $table = 'user_settings';

    protected $guarded = ['id'];

    // Espelha os defaults da migration, para o model recém-criado já vir preenchido.
    protected $attributes = [
        'notify_upcoming_days' => 3,
        'auto_pay_invoices' => false,
        'notify_overdue_days' => 3,
    ];

    protected $casts = [
        'notify_upcoming_days' => 'integer',
        'auto_pay_invoices' => 'boolean',
        'auto_pay_invoices_since' => 'date',
        'notify_overdue_days' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Configurações do usuário; cria com os valores padrão na primeira vez.
     */
    public static function doUsuario(int $userId): self
    {
        return self::firstOrCreate(['user_id' => $userId]);
    }
}
