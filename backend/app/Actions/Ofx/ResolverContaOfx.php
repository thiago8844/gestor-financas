<?php

namespace App\Actions\Ofx;

use App\Models\OfxAccountMapping;
use App\Support\Ofx\Dto\OfxParsedFile;

/**
 * Resolve a associação entre a fonte bancária de um OFX (banco+agência+conta) e a
 * conta do app escolhida pelo usuário, opcionalmente lembrando essa associação
 * para que as próximas importações do mesmo banco/conta já venham pré-selecionadas.
 */
class ResolverContaOfx
{
    public function hash(OfxParsedFile $arquivo): string
    {
        return hash('sha256', implode('|', [
            $arquivo->bankId ?? '',
            $arquivo->branchId ?? '',
            $arquivo->acctId ?? '',
        ]));
    }

    public function buscarMapeamento(int $userId, string $accountHash): ?OfxAccountMapping
    {
        return OfxAccountMapping::where('user_id', $userId)
            ->where('account_hash', $accountHash)
            ->first();
    }

    public function lembrar(int $userId, OfxParsedFile $arquivo, string $accountHash, int $accountId): OfxAccountMapping
    {
        return OfxAccountMapping::updateOrCreate(
            ['user_id' => $userId, 'account_hash' => $accountHash],
            [
                'bank_id' => $arquivo->bankId,
                'account_number_masked' => $this->mascarar($arquivo->acctId),
                'acct_type' => $arquivo->acctType,
                'account_id' => $accountId,
            ]
        );
    }

    private function mascarar(?string $acctId): ?string
    {
        if (!$acctId) {
            return null;
        }

        $limpo = preg_replace('/\D/', '', $acctId) ?: $acctId;

        return '****' . substr($limpo, -4);
    }
}
