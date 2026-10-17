<?php

namespace App\Enums;

/**
 * PENDENTE: ainda sem decisão. CONCILIADO: bate com lançamento(s) do app.
 * ADIADO: o usuário vai lançar depois — segura o fechamento do mês e gera aviso.
 * IGNORADO: decidido que não entra (com motivo) — não segura o fechamento.
 */
enum StatusItemConciliacao: string
{
    case PENDENTE = 'PENDENTE';
    case CONCILIADO = 'CONCILIADO';
    case ADIADO = 'ADIADO';
    case IGNORADO = 'IGNORADO';

    /** Ainda precisa de ação do usuário antes de fechar o mês. */
    public function bloqueiaFechamento(): bool
    {
        return $this === self::PENDENTE || $this === self::ADIADO;
    }
}
