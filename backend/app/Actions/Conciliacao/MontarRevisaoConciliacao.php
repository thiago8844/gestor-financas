<?php

namespace App\Actions\Conciliacao;

use App\Enums\OrigemItemConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Http\Resources\AuditoriaFaturaResource;
use App\Http\Resources\ConciliacaoResource;
use App\Models\Cartao;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Support\Conciliacao\Dto\EntradaRazao;
use Carbon\Carbon;

/**
 * Tudo que a tela de revisão precisa numa resposta só: linhas do extrato com o que casou (ou a
 * sugestão e os candidatos), o que está só no app, as faturas que podem ser o pagamento de uma
 * linha, a prova do saldo e o que ainda impede de finalizar.
 */
class MontarRevisaoConciliacao
{
    public static function executar(Conciliacao $conciliacao): array
    {
        $conciliacao->loadMissing('conta');

        $itens = $conciliacao->itens()
            ->with(['transacoes.categoria:id,name', 'fatura.cartao:id,name'])
            ->orderBy('transaction_date')
            ->orderBy('id')
            ->get();

        $livres = RazaoDaConciliacao::livres($conciliacao);
        $livresPorChave = $livres->keyBy('chave');
        $conciliador = RazaoDaConciliacao::conciliador();

        $abertos = $itens->filter(fn (ConciliacaoItem $i) => $i->source === OrigemItemConciliacao::EXTRATO && $i->status->bloqueiaFechamento());
        $sugestoes = $conciliacao->isFinalizada()
            ? []
            : $conciliador->parear(RazaoDaConciliacao::linhas($abertos), $livres->all());

        $quebrados = 0;

        $linhas = $itens->map(function (ConciliacaoItem $item) use ($conciliacao, $conciliador, $livres, $livresPorChave, $sugestoes, &$quebrados) {
            $quebrado = $item->status === StatusItemConciliacao::CONCILIADO
                && !VinculoConciliacao::valido($item, $conciliacao->account_id);
            $quebrados += $quebrado ? 1 : 0;

            $dados = [
                'id' => $item->id,
                'source' => $item->source,
                'fitid' => $item->fitid,
                'type' => $item->type,
                'amount' => (float) $item->amount,
                'transaction_date' => $item->transaction_date->toDateString(),
                'description' => $item->description,
                'status' => $item->status,
                'matched_by' => $item->matched_by,
                'note' => $item->note,
                'resolved_at' => $item->resolved_at?->toDateTimeString(),
                'invoice_id' => $item->invoice_id,
                'vinculo_quebrado' => $quebrado,
                'fatura' => $item->fatura ? [
                    'id' => $item->fatura->id,
                    'cartao' => $item->fatura->cartao?->name,
                    'reference_month' => $item->fatura->reference_month->toDateString(),
                    'due_date' => $item->fatura->due_date->toDateString(),
                ] : null,
                'lancamentos' => $item->transacoes->map(fn (Transacao $t) => [
                    'id' => $t->id,
                    'description' => $t->description,
                    'amount' => (float) $t->amount,
                    'type' => $t->type,
                    'status' => $t->status,
                    'date' => $t->date?->toDateString(),
                    'categoria' => $t->categoria?->name,
                    'card_id' => $t->card_id,
                    'invoice_id' => $t->invoice_id,
                    'is_rolagem_fatura' => $t->isRolagemDeFatura(),
                ])->values(),
                'sugestao' => null,
                'candidatos' => [],
            ];

            if ($item->source === OrigemItemConciliacao::EXTRATO && $item->status->bloqueiaFechamento() && !$conciliacao->isFinalizada()) {
                if (isset($sugestoes[$item->id])) {
                    $par = $sugestoes[$item->id];
                    $dados['sugestao'] = [
                        'chave' => $par['chave'],
                        'confianca' => $par['confianca'],
                        'dias' => $par['dias'],
                        'entrada' => $livresPorChave[$par['chave']]->toArray(),
                    ];
                }

                $dados['candidatos'] = collect($conciliador->candidatos(RazaoDaConciliacao::linha($item), $livres->all()))
                    ->map(fn (array $c) => [...$c, 'entrada' => $livresPorChave[$c['chave']]->toArray()])
                    ->values()
                    ->all();
            }

            return $dados;
        })->values();

        // O que já é a sugestão de alguma linha pendente não está "só no app": é o par provável dela.
        // Mostrar nos dois lugares levaria o usuário a confirmar/desfazer justamente o lançamento certo.
        $sugeridas = collect($sugestoes)->pluck('chave')->flip();
        $soNoApp = RazaoDaConciliacao::soNoApp($conciliacao, $livres)
            ->reject(fn (EntradaRazao $e) => $sugeridas->has($e->chave))
            ->values();
        $extrato = $itens->where('source', OrigemItemConciliacao::EXTRATO);
        $saldo = FecharConciliacao::saldos($conciliacao);

        $resumo = [
            'linhas' => $extrato->count(),
            'conciliadas' => $extrato->where('status', StatusItemConciliacao::CONCILIADO)->count(),
            'conciliadas_auto' => $extrato->where('status', StatusItemConciliacao::CONCILIADO)->where('matched_by', 'AUTO')->count(),
            'pendentes' => $extrato->where('status', StatusItemConciliacao::PENDENTE)->count(),
            'adiadas' => $extrato->where('status', StatusItemConciliacao::ADIADO)->count(),
            'ignoradas' => $extrato->where('status', StatusItemConciliacao::IGNORADO)->count(),
            'so_no_app' => $soNoApp->count(),
            'mantidos_so_no_app' => $itens->where('source', OrigemItemConciliacao::APP)->count(),
            'sugestoes' => count($sugestoes),
            'vinculos_quebrados' => $quebrados,
            'entradas' => round((float) $extrato->where('type', TransactionType::INCOME)->sum('amount'), 2),
            'saidas' => round((float) $extrato->where('type', TransactionType::EXPENSE)->sum('amount'), 2),
        ];

        $motivos = [];

        if ($resumo['pendentes'] > 0) {
            $motivos[] = "{$resumo['pendentes']} linha(s) do extrato sem resolução";
        }

        if ($resumo['adiadas'] > 0) {
            $motivos[] = "{$resumo['adiadas']} linha(s) adiada(s) para lançar depois";
        }

        if ($resumo['so_no_app'] > 0) {
            $motivos[] = "{$resumo['so_no_app']} lançamento(s) só no app sem decisão";
        }

        return [
            'conciliacao' => ConciliacaoResource::make($conciliacao)->resolve(),
            'resumo' => $resumo,
            'saldo' => $saldo,
            'itens' => $linhas,
            'so_no_app' => $soNoApp->map(fn (EntradaRazao $e) => $e->toArray())->values(),
            'faturas' => self::faturasCandidatas($conciliacao),
            'pode_finalizar' => $motivos === [] && !$conciliacao->isFinalizada(),
            'motivos_bloqueio' => $motivos,
            'tolerancia_dias' => RazaoDaConciliacao::tolerancia(),
        ];
    }

    /**
     * Faturas dos cartões pagos por esta conta com vencimento perto do mês: são as candidatas a
     * "esta linha é o pagamento da fatura".
     */
    private static function faturasCandidatas(Conciliacao $conciliacao): array
    {
        $janela = (int) config('conciliacao.janela_faturas_dias', 25);
        $cartaoIds = Cartao::where('user_id', $conciliacao->user_id)
            ->where('account_id', $conciliacao->account_id)
            ->pluck('id');

        if ($cartaoIds->isEmpty()) {
            return [];
        }

        return Fatura::whereIn('card_id', $cartaoIds)
            ->whereDate('due_date', '>=', Carbon::parse($conciliacao->period_start)->subDays($janela)->toDateString())
            ->whereDate('due_date', '<=', Carbon::parse($conciliacao->period_end)->addDays($janela)->toDateString())
            ->with(['cartao:id,name', 'parcelas', 'auditorias'])
            ->orderBy('due_date')
            ->get()
            ->map(fn (Fatura $fatura) => self::resumoFatura($fatura))
            ->values()
            ->all();
    }

    public static function resumoFatura(Fatura $fatura): array
    {
        $resumo = $fatura->resumoValores();
        $auditoria = $fatura->auditorias->sortByDesc('id')->first();

        $pagamentos = collect($resumo['pagamentos'])->map(function (array $pagamento) use ($fatura) {
            $grupo = $fatura->parcelas->filter(
                fn (Transacao $t) => $t->status === TransactionStatus::PAID && $t->date?->toDateString() === $pagamento['data']
            );

            return [...$pagamento, 'conciliado' => $grupo->isNotEmpty() && $grupo->every(fn (Transacao $t) => $t->reconciliation_item_id !== null)];
        })->values()->all();

        return [
            'id' => $fatura->id,
            'card_id' => $fatura->card_id,
            'cartao' => $fatura->cartao?->name,
            'reference_month' => $fatura->reference_month->toDateString(),
            'closing_date' => $fatura->closing_date->toDateString(),
            'due_date' => $fatura->due_date->toDateString(),
            'total' => $resumo['total'],
            'pago' => $resumo['pago'],
            'pendente' => $resumo['pendente'],
            'levado_para_proxima' => $resumo['levado_para_proxima'],
            'paga' => $resumo['paga'],
            'pagamentos' => $pagamentos,
            'lancamentos' => $fatura->parcelas->count(),
            'auditoria' => $auditoria ? AuditoriaFaturaResource::make($auditoria)->comTotalAtual($resumo['total'])->resolve() : null,
        ];
    }
}
