<?php

namespace App\Actions\Conciliacao;

use App\Enums\StatusConciliacao;
use App\Enums\StatusItemConciliacao;
use App\Http\Resources\ConciliacaoResource;
use App\Models\Cartao;
use App\Models\Conciliacao;
use App\Models\Conta;
use App\Models\Fatura;
use App\Queries\Conciliacao\ContagensConciliacaoQuery;
use Carbon\Carbon;

/**
 * Painel "Fechamento do mês": o checklist de tudo que falta auditar no mês — cada conta (com o
 * status da conciliação) e cada fatura que venceu no mês (com o status da auditoria manual).
 */
class MontarPainelFechamento
{
    /** Rótulos de conta que normalmente têm extrato bancário (o campo é texto livre no cadastro). */
    private const ROTULOS_BANCARIOS = ['banco', 'conta corrente', 'poupança', 'poupanca'];

    public static function executar(int $userId, Carbon $mes): array
    {
        $inicio = $mes->copy()->startOfMonth();
        $fim = $inicio->copy()->endOfMonth();

        $contas = Conta::where('user_id', $userId)->where('active', true)->orderBy('name')->get();

        $doMes = ContagensConciliacaoQuery::aplicar(Conciliacao::query())
            ->where('user_id', $userId)
            ->whereDate('reference_month', $inicio->toDateString())
            ->with(['itens.transacoes'])
            ->get()
            ->keyBy('account_id');

        $jaConciliadas = Conciliacao::where('user_id', $userId)->distinct()->pluck('account_id')->flip();

        $ultimasFinalizadas = Conciliacao::where('user_id', $userId)
            ->where('status', StatusConciliacao::FINALIZADA->value)
            ->get(['account_id', 'reference_month'])
            ->groupBy('account_id')
            ->map(fn ($lista) => $lista->max(fn ($c) => $c->reference_month->format('Y-m')));

        $linhasContas = $contas->map(function (Conta $conta) use ($doMes, $jaConciliadas, $ultimasFinalizadas) {
            $conciliacao = $doMes->get($conta->id);
            $quebrados = 0;

            if ($conciliacao?->isFinalizada()) {
                $quebrados = $conciliacao->itens
                    ->filter(fn ($i) => $i->status === StatusItemConciliacao::CONCILIADO && !VinculoConciliacao::valido($i, $conta->id))
                    ->count();
            }

            $rotulo = mb_strtolower(trim((string) $conta->role));

            return [
                'id' => $conta->id,
                'name' => $conta->name,
                'instituicao' => $conta->instituicao,
                'role' => $conta->role,
                // Contas que costumam ter extrato contam no progresso; as demais (cofre, investimento) são opcionais.
                'esperada' => $rotulo === '' || in_array($rotulo, self::ROTULOS_BANCARIOS, true)
                    || $jaConciliadas->has($conta->id),
                'situacao' => $conciliacao ? $conciliacao->status->value : 'SEM_EXTRATO',
                'vinculos_quebrados' => $quebrados,
                'ultima_finalizada' => $ultimasFinalizadas->get($conta->id),
                'conciliacao' => $conciliacao ? ConciliacaoResource::make($conciliacao)->resolve() : null,
            ];
        })->values();

        $cartoes = Cartao::where('user_id', $userId)->with('conta:id,name')->get()->keyBy('id');

        $faturas = $cartoes->isEmpty() ? collect() : Fatura::whereIn('card_id', $cartoes->keys())
            ->whereDate('due_date', '>=', $inicio->toDateString())
            ->whereDate('due_date', '<=', $fim->toDateString())
            ->with(['cartao:id,name', 'parcelas', 'auditorias'])
            ->orderBy('due_date')
            ->get()
            ->filter(fn (Fatura $f) => $f->parcelas->isNotEmpty())
            ->map(function (Fatura $fatura) use ($cartoes) {
                $resumo = MontarRevisaoConciliacao::resumoFatura($fatura);
                $cartao = $cartoes->get($fatura->card_id);

                return [
                    ...$resumo,
                    'conta_nome' => $cartao?->conta?->name,
                    'pagamento_conciliado' => collect($resumo['pagamentos'])->contains(fn ($p) => $p['conciliado']),
                ];
            })
            ->values();

        $contasEsperadas = $linhasContas->where('esperada', true);
        $concluidas = $contasEsperadas->where('situacao', StatusConciliacao::FINALIZADA->value)->where('vinculos_quebrados', 0)->count()
            + $faturas->filter(fn ($f) => ($f['auditoria']['status'] ?? null) === 'CONFERE')->count();

        return [
            'mes' => $inicio->format('Y-m'),
            'contas' => $linhasContas,
            'faturas' => $faturas,
            'progresso' => [
                'concluidos' => $concluidas,
                'total' => $contasEsperadas->count() + $faturas->count(),
            ],
        ];
    }
}
