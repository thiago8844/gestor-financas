<?php

namespace App\Actions\Ofx;

use App\Actions\Ofx\Exceptions\OfxArquivoDuplicadoException;
use App\Actions\Ofx\Exceptions\OfxContaNaoInformadaException;
use App\Enums\OfxImportItemStatus;
use App\Models\OfxImport;
use App\Models\OfxImportItem;
use App\Models\OfxImportRule;
use App\Models\Transacao;
use App\Support\Ofx\OfxParser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class ImportarArquivoOfx
{
    public static function executar(
        int $userId,
        UploadedFile $arquivo,
        ?int $contaId,
        bool $lembrarConta
    ): OfxImport {
        $conteudo = file_get_contents($arquivo->getRealPath());
        $fileHash = hash('sha256', $conteudo);

        $existente = OfxImport::where('user_id', $userId)->where('file_hash', $fileHash)->first();

        if ($existente) {
            throw new OfxArquivoDuplicadoException($existente);
        }

        $arquivoParseado = (new OfxParser())->parse($conteudo);

        $resolver = new ResolverContaOfx();
        $accountHash = $resolver->hash($arquivoParseado);

        $accountId = $contaId;

        if (!$accountId) {
            $mapeamento = $resolver->buscarMapeamento($userId, $accountHash);
            $accountId = $mapeamento?->account_id;
        }

        if (!$accountId) {
            throw new OfxContaNaoInformadaException($arquivoParseado, $accountHash);
        }

        $storagePath = Storage::disk('local')->putFileAs(
            "ofx-imports/{$userId}",
            $arquivo,
            "{$fileHash}.ofx"
        );

        return DB::transaction(function () use ($userId, $accountId, $lembrarConta, $arquivoParseado, $resolver, $accountHash, $fileHash, $arquivo, $storagePath) {
            $import = OfxImport::create([
                'user_id' => $userId,
                'account_id' => $accountId,
                'original_filename' => $arquivo->getClientOriginalName(),
                'file_hash' => $fileHash,
                'storage_path' => $storagePath,
                'ofx_version' => $arquivoParseado->ofxVersion,
                'period_start' => $arquivoParseado->periodStart,
                'period_end' => $arquivoParseado->periodEnd,
                'total_transactions' => count($arquivoParseado->transactions),
            ]);

            if ($lembrarConta) {
                $resolver->lembrar($userId, $arquivoParseado, $accountHash, $accountId);
            }

            $duplicadas = 0;

            foreach ($arquivoParseado->transactions as $transacao) {
                $correspondente = $transacao->fitid
                    ? Transacao::where('user_id', $userId)
                        ->where('account_id', $accountId)
                        ->where('fitid', $transacao->fitid)
                        ->first()
                    : null;

                if ($correspondente) {
                    $duplicadas++;
                }

                OfxImportItem::create([
                    'ofx_import_id' => $import->id,
                    'user_id' => $userId,
                    'fitid' => $transacao->fitid,
                    'type' => $transacao->type,
                    'amount' => $transacao->amount,
                    'transaction_date' => $transacao->datePosted->toDateString(),
                    'descricao_original' => $transacao->descricaoOriginal,
                    'descricao' => $transacao->descricaoOriginal,
                    'account_id' => $accountId,
                    'status' => $correspondente ? OfxImportItemStatus::DUPLICADA : OfxImportItemStatus::PENDENTE,
                    'selecionada' => !$correspondente,
                    'matched_transaction_id' => $correspondente?->id,
                ]);
            }

            $import->update(['duplicate_transactions' => $duplicadas]);

            $regrasAtivas = OfxImportRule::where('user_id', $userId)->where('active', true)->get();
            $aplicador = new AplicarRegraOfx();

            foreach ($regrasAtivas as $regra) {
                $aplicador->executar($regra, $import->id);
            }

            return $import->fresh(['itens', 'conta']);
        });
    }
}
