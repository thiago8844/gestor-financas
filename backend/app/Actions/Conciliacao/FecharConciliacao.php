<?php

namespace App\Actions\Conciliacao;

use App\Actions\Conciliacao\Exceptions\ConciliacaoException;
use App\Actions\Faturas\PagarFatura;
use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Enums\TransactionType;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Queries\Conciliacao\SaldoContaAteDataQuery;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Fechar o mês: só finaliza quando todas as linhas do extrato tiverem destino (conciliada ou
 * ignorada com motivo — adiada segura) e não sobrar lançamento "só no app" sem decisão. Se o saldo
 * do banco e o do app não baterem, exige uma justificativa. O retrato do fechamento fica gravado.
 */
class FecharConciliacao
{
    public static function finalizar(Conciliacao $conciliacao, ?string $observacao = null): Conciliacao
    {
        VinculoConciliacao::exigirAberta($conciliacao);

        // Reconfere antes: desfaz vínculo quebrado e pega o que foi lançado nesse meio-tempo.
        ReconferirConciliacao::executar($conciliacao);

        $pendencias = self::pendencias($conciliacao);

        if ($pendencias['linhas'] > 0) {
            throw new ConciliacaoException(
                "Ainda há {$pendencias['linhas']} linha(s) do extrato sem resolução (pendentes ou adiadas).",
                422,
                ['pendencias' => $pendencias]
            );
        }

        if ($pendencias['so_no_app'] > 0) {
            throw new ConciliacaoException(
                "Há {$pendencias['so_no_app']} lançamento(s) pagos no app neste mês que não aparecem no extrato. "
                . 'Corrija, volte para pendente ou confirme que estão certos antes de finalizar.',
                422,
                ['pendencias' => $pendencias]
            );
        }

        $saldo = self::saldos($conciliacao);
        $observacao = trim((string) $observacao) ?: null;

        if ($saldo['diferenca'] !== null && abs($saldo['diferenca']) >= 0.005 && $observacao === null) {
            throw new ConciliacaoException(
                'O saldo do app difere do saldo do banco em R$ ' . number_format(abs($saldo['diferenca']), 2, ',', '.')
                . '. Escreva uma observação explicando para finalizar mesmo assim.',
                422,
                ['exige_observacao' => true, 'saldo' => $saldo]
            );
        }

        return DB::transaction(function () use ($conciliacao, $observacao, $saldo) {
            $conciliacao->update([
                'status' => StatusConciliacao::FINALIZADA,
                'finalized_at' => now(),
                'note' => $observacao,
                'summary' => self::retrato($conciliacao, $saldo),
            ]);

            return $conciliacao->fresh();
        });
    }

    public static function reabrir(Conciliacao $conciliacao): Conciliacao
    {
        if (!$conciliacao->isFinalizada()) {
            throw new ConciliacaoException('Esta conciliação já está aberta.', 409);
        }

        // O retrato do último fechamento continua guardado até finalizar de novo.
        $conciliacao->update([
            'status' => StatusConciliacao::ABERTA,
            'reopened_at' => now(),
        ]);

        return $conciliacao->fresh();
    }

    /** @return array{linhas: int, pendentes: int, adiadas: int, so_no_app: int} */
    public static function pendencias(Conciliacao $conciliacao): array
    {
        $itens = $conciliacao->itens()->where('source', OrigemItemConciliacao::EXTRATO->value)->get();
        $pendentes = $itens->where('status', StatusItemConciliacao::PENDENTE)->count();
        $adiadas = $itens->where('status', StatusItemConciliacao::ADIADO)->count();

        return [
            'linhas' => $pendentes + $adiadas,
            'pendentes' => $pendentes,
            'adiadas' => $adiadas,
            'so_no_app' => RazaoDaConciliacao::soNoApp($conciliacao, RazaoDaConciliacao::livres($conciliacao))->count(),
        ];
    }

    /**
     * Saldo do banco (do OFX) contra o saldo do app no mesmo dia. Sem saldo no OFX, compara nada
     * (diferenca null) e mostra só o saldo do app no fim do mês.
     *
     * @return array{banco: ?float, data: string, app: float, diferenca: ?float}
     */
    public static function saldos(Conciliacao $conciliacao): array
    {
        $data = Carbon::parse($conciliacao->statement_balance_date ?? $conciliacao->period_end);
        $app = SaldoContaAteDataQuery::calcular($conciliacao->account_id, $data);
        $banco = $conciliacao->statement_balance !== null ? (float) $conciliacao->statement_balance : null;

        return [
            'banco' => $banco,
            'data' => $data->toDateString(),
            'app' => $app,
            'diferenca' => $banco === null ? null : round($banco - $app, 2),
        ];
    }

    private static function retrato(Conciliacao $conciliacao, array $saldo): array
    {
        $itens = $conciliacao->itens()->with(['fatura.cartao', 'fatura.parcelas', 'fatura.auditorias'])->get();
        $extrato = $itens->where('source', OrigemItemConciliacao::EXTRATO);
        $conciliadas = $extrato->where('status', StatusItemConciliacao::CONCILIADO);

        $faturas = $itens->filter(fn (ConciliacaoItem $i) => $i->fatura !== null)
            ->map(function (ConciliacaoItem $i) {
                $fatura = $i->fatura;
                $total = $fatura->resumoValores()['total'];
                $auditoria = $fatura->auditorias->sortByDesc('id')->first();

                return [
                    'fatura_id' => $fatura->id,
                    'cartao' => $fatura->cartao?->name,
                    'referencia' => PagarFatura::mesAno($fatura->reference_month),
                    'valor_debitado' => (float) $i->amount,
                    'total_fatura' => $total,
                    'auditoria' => $auditoria
                        ? (abs((float) $auditoria->bank_total - $total) < 0.005 ? 'CONFERE' : 'DIVERGENTE')
                        : 'NAO_AUDITADA',
                ];
            })
            ->values()
            ->all();

        return [
            'conta' => $conciliacao->conta?->name,
            'arquivo' => $conciliacao->original_filename,
            'arquivo_hash' => $conciliacao->file_hash,
            'linhas_extrato' => $extrato->count(),
            'conciliadas_automaticamente' => $conciliadas->where('matched_by', 'AUTO')->count(),
            'conciliadas_manualmente' => $conciliadas->where('matched_by', 'MANUAL')->count(),
            'ignoradas' => $extrato->where('status', StatusItemConciliacao::IGNORADO)->count(),
            'mantidos_so_no_app' => $itens->where('source', OrigemItemConciliacao::APP)->count(),
            'entradas_extrato' => round((float) $extrato->where('type', TransactionType::INCOME)->sum('amount'), 2),
            'saidas_extrato' => round((float) $extrato->where('type', TransactionType::EXPENSE)->sum('amount'), 2),
            'saldo' => $saldo,
            'faturas' => $faturas,
            'finalizada_em' => now()->toDateTimeString(),
        ];
    }
}
