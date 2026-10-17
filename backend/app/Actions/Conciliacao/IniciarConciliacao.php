<?php

namespace App\Actions\Conciliacao;

use App\Actions\Conciliacao\Exceptions\ConciliacaoException;
use App\Actions\Ofx\ResolverContaOfx;
use App\Enums\OrigemItemConciliacao;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Models\Conta;
use App\Support\Ofx\Dto\OfxParsedFile;
use App\Support\Ofx\Dto\OfxParsedTransaction;
use App\Support\Ofx\OfxParser;
use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Recebe o extrato (OFX da conta corrente) de um mês e abre — ou atualiza — a conciliação daquela
 * conta naquele mês. Mandar de novo um extrato mais completo do mesmo mês só acrescenta as linhas
 * novas; o que já foi resolvido continua resolvido. Um OFX de vários meses pode ser usado em cada
 * um deles: só entram as linhas do mês escolhido.
 */
class IniciarConciliacao
{
    /**
     * @return array{conciliacao: Conciliacao, novas: int, ja_existentes: int, fora_do_periodo: int, auto_conciliadas: int}
     */
    public static function executar(int $userId, UploadedFile $arquivo, ?int $contaId, ?string $mes, bool $lembrarConta): array
    {
        $conteudo = (string) file_get_contents($arquivo->getRealPath());
        $hash = hash('sha256', $conteudo);

        $extrato = (new OfxParser())->parse($conteudo);

        if (strtoupper((string) $extrato->acctType) === 'CREDITCARD') {
            throw new ConciliacaoException(
                'Este arquivo é extrato de cartão de crédito. A conciliação usa o extrato da conta corrente; '
                . 'para conferir a fatura, registre a auditoria na própria fatura (tela de Cartões).'
            );
        }

        if (count($extrato->transactions) === 0) {
            throw new ConciliacaoException('O extrato não tem nenhum lançamento.');
        }

        $resolver = new ResolverContaOfx();
        $accountHash = $resolver->hash($extrato);
        $contaId ??= $resolver->buscarMapeamento($userId, $accountHash)?->account_id;

        if (!$contaId) {
            throw new ConciliacaoException('Selecione a conta deste extrato.', 422, [
                'necessita_conta' => true,
                'banco_detectado' => [
                    'bank_id' => $extrato->bankId,
                    'branch_id' => $extrato->branchId,
                    'acct_id' => $extrato->acctId,
                    'acct_type' => $extrato->acctType,
                ],
            ]);
        }

        $conta = Conta::where('user_id', $userId)->find($contaId);

        if (!$conta) {
            throw new ConciliacaoException('Conta não encontrada.', 404);
        }

        $inicio = ($mes ? Carbon::createFromFormat('Y-m-d', "{$mes}-01") : self::mesPredominante($extrato))->startOfMonth();
        $fim = $inicio->copy()->endOfMonth();

        $conciliacao = Conciliacao::where('account_id', $conta->id)
            ->whereDate('reference_month', $inicio->toDateString())
            ->first();

        if ($conciliacao?->isFinalizada()) {
            throw new ConciliacaoException(
                "A conciliação de {$inicio->format('m/Y')} desta conta já foi finalizada. Reabra-a para enviar um novo extrato.",
                409,
                ['conciliacao_id' => $conciliacao->id]
            );
        }

        if ($lembrarConta) {
            $resolver->lembrar($userId, $extrato, $accountHash, $conta->id);
        }

        $storagePath = Storage::disk('local')->putFileAs("conciliacoes/{$userId}", $arquivo, "{$hash}.ofx");

        $resultado = DB::transaction(function () use ($userId, $conta, $inicio, $fim, $conciliacao, $extrato, $arquivo, $hash, $storagePath) {
            $conciliacao ??= new Conciliacao([
                'user_id' => $userId,
                'account_id' => $conta->id,
                'reference_month' => $inicio->toDateString(),
            ]);

            $conciliacao->fill([
                'period_start' => $inicio->toDateString(),
                'period_end' => $fim->toDateString(),
                'original_filename' => $arquivo->getClientOriginalName(),
                'file_hash' => $hash,
                'storage_path' => $storagePath,
            ]);

            if ($extrato->ledgerBalance !== null) {
                $conciliacao->statement_balance = $extrato->ledgerBalance;
                $conciliacao->statement_balance_date = ($extrato->ledgerBalanceDate ?? $extrato->periodEnd ?? $fim)->toDateString();
            }

            $conciliacao->save();

            $existentes = $conciliacao->itens()->pluck('external_id')->flip();
            $vistosNoArquivo = [];
            $novas = 0;
            $jaExistentes = 0;
            $foraDoPeriodo = 0;

            foreach ($extrato->transactions as $linha) {
                $data = $linha->datePosted->toDateString();

                if ($data < $inicio->toDateString() || $data > $fim->toDateString()) {
                    $foraDoPeriodo++;

                    continue;
                }

                $base = self::idExterno($linha);
                $ocorrencia = $vistosNoArquivo[$base] = ($vistosNoArquivo[$base] ?? 0) + 1;
                // Mesmo FITID (ou linha idêntica) repetido no arquivo: cada repetição é uma linha própria.
                $externo = $ocorrencia > 1 ? "{$base}#{$ocorrencia}" : $base;

                if ($existentes->has($externo)) {
                    $jaExistentes++;

                    continue;
                }

                ConciliacaoItem::create([
                    'reconciliation_id' => $conciliacao->id,
                    'user_id' => $userId,
                    'source' => OrigemItemConciliacao::EXTRATO,
                    'external_id' => $externo,
                    'fitid' => $linha->fitid,
                    'type' => $linha->type,
                    'amount' => round($linha->amount, 2),
                    'transaction_date' => $data,
                    'description' => $linha->descricaoOriginal,
                ]);

                $novas++;
            }

            if ($novas + $jaExistentes === 0) {
                throw new ConciliacaoException(
                    "O extrato não tem lançamentos em {$inicio->format('m/Y')}. Confira o mês escolhido."
                );
            }

            return compact('novas', 'jaExistentes', 'foraDoPeriodo') + ['conciliacao' => $conciliacao];
        });

        $conciliacao = $resultado['conciliacao'];
        $reconferencia = ReconferirConciliacao::executar($conciliacao);

        return [
            'conciliacao' => $conciliacao->fresh(),
            'novas' => $resultado['novas'],
            'ja_existentes' => $resultado['jaExistentes'],
            'fora_do_periodo' => $resultado['foraDoPeriodo'],
            'auto_conciliadas' => $reconferencia['conciliados'],
        ];
    }

    /** O mês com mais lançamentos no arquivo (empate: o mais recente). */
    public static function mesPredominante(OfxParsedFile $extrato): Carbon
    {
        $porMes = [];

        foreach ($extrato->transactions as $linha) {
            $chave = $linha->datePosted->format('Y-m');
            $porMes[$chave] = ($porMes[$chave] ?? 0) + 1;
        }

        uksort($porMes, fn ($a, $b) => [$porMes[$b], $b] <=> [$porMes[$a], $a]);

        return Carbon::createFromFormat('Y-m-d', array_key_first($porMes) . '-01')->startOfDay();
    }

    private static function idExterno(OfxParsedTransaction $linha): string
    {
        if ($linha->fitid) {
            return 'fitid:' . $linha->fitid;
        }

        return 'hash:' . sha1(implode('|', [
            $linha->datePosted->toDateString(),
            $linha->type->value,
            number_format($linha->amount, 2, '.', ''),
            mb_strtoupper(trim($linha->descricaoOriginal)),
        ]));
    }
}
