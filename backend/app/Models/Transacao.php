<?php

namespace App\Models;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transacao extends Model
{

    use HasFactory;

    protected $guarded = ['id'];
    protected $table = 'transactions';

    protected $casts = [
        "type" => TransactionType::class,
        "status" => TransactionStatus::class,
        "date" => 'datetime'
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function conta(): BelongsTo
    {
        return $this->belongsTo(Conta::class, 'account_id');
    }

    // -=-=-=- PARCELAMENTO -=-=-=-

    public function scopeParcelasDoGrupo($query, string $grupo_uuid)
    {
        return $query->where('installment_group', $grupo_uuid)
            ->orderBy('installmente_number');
    }

    public static function resumoParcelas(string $grupo): array
    {
        return [
            'total' => static::where('installment_group', $grupo)->sum('amount'),
            'pagas' => static::where('installment_group', $grupo)
                ->where('status', TransactionStatus::PAID)
                ->sum('amount'),
            'pendentes' => static::where('installment_group', $grupo)
                ->where('status', TransactionStatus::PENDING)
                ->sum('amount'),
            'quantidade' => static::where('installment_group', $grupo)->count(),
        ];
    }
}
