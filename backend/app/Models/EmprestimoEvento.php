<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmprestimoEvento extends Model
{
    protected $table = 'loan_events';
    protected $guarded = ['id'];

    protected $casts = [
        'data' => 'array',
    ];

    public function emprestimo(): BelongsTo
    {
        return $this->belongsTo(Emprestimo::class, 'loan_id');
    }

    public function parcela(): BelongsTo
    {
        return $this->belongsTo(EmprestimoParcela::class, 'installment_id');
    }

    public static function registrar(Emprestimo $emprestimo, string $tipo, string $mensagem, ?int $parcelaId = null, ?array $dados = null): self
    {
        return self::create([
            'loan_id' => $emprestimo->id,
            'installment_id' => $parcelaId,
            'type' => $tipo,
            'message' => $mensagem,
            'data' => $dados,
        ]);
    }
}
