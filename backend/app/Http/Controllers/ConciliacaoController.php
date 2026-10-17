<?php

namespace App\Http\Controllers;

use App\Actions\Conciliacao\AceitarSugestoesConciliacao;
use App\Actions\Conciliacao\Exceptions\ConciliacaoException;
use App\Actions\Conciliacao\FecharConciliacao;
use App\Actions\Conciliacao\IniciarConciliacao;
use App\Actions\Conciliacao\MontarPainelFechamento;
use App\Actions\Conciliacao\MontarRevisaoConciliacao;
use App\Actions\Conciliacao\ReconferirConciliacao;
use App\Actions\Conciliacao\ResolverItemConciliacao;
use App\Actions\Conciliacao\ResolverPagamentoFaturaConciliacao;
use App\Actions\Conciliacao\SoNoAppConciliacao;
use App\Http\Requests\Conciliacao\IniciarConciliacaoRequest;
use App\Http\Resources\ConciliacaoResource;
use App\Models\Categoria;
use App\Models\Conciliacao;
use App\Models\ConciliacaoItem;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Queries\Conciliacao\ContagensConciliacaoQuery;
use App\Support\Ofx\Exceptions\OfxParseException;
use Carbon\Carbon;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Conciliação bancária. Toda ação sobre uma conciliação devolve a revisão inteira atualizada
 * (`data`), para a tela se redesenhar com uma requisição só.
 */
class ConciliacaoController extends Controller
{
    /** Histórico: conciliações do usuário, da mais recente para a mais antiga. */
    public function index(Request $request)
    {
        $conciliacoes = ContagensConciliacaoQuery::aplicar(Conciliacao::query())
            ->with('conta:id,name')
            ->where('user_id', Auth::id())
            ->when($request->filled('conta_id'), fn ($q) => $q->where('account_id', $request->integer('conta_id')))
            ->orderByDesc('reference_month')
            ->orderBy('account_id')
            ->get();

        return ConciliacaoResource::collection($conciliacoes);
    }

    /** Painel "Fechamento do mês" (padrão: mês anterior até o dia 10, depois o mês atual). */
    public function painel(Request $request)
    {
        $request->validate(['mes' => ['nullable', 'date_format:Y-m']]);

        $mes = $request->filled('mes')
            ? Carbon::createFromFormat('Y-m-d', $request->mes . '-01')
            : (now()->day <= 10 ? now()->subMonthNoOverflow() : now());

        return response()->json(['data' => MontarPainelFechamento::executar(Auth::id(), $mes->startOfMonth())]);
    }

    /** Envia o extrato (OFX) e abre/atualiza a conciliação do mês daquela conta. */
    public function store(IniciarConciliacaoRequest $request)
    {
        try {
            $resultado = IniciarConciliacao::executar(
                Auth::id(),
                $request->file('arquivo'),
                $request->integer('conta_id') ?: null,
                $request->input('mes'),
                $request->boolean('lembrar_conta')
            );
        } catch (ConciliacaoException $e) {
            return $this->erro($e);
        } catch (OfxParseException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $partes = ["{$resultado['novas']} linha(s) nova(s)"];

        if ($resultado['auto_conciliadas'] > 0) {
            $partes[] = "{$resultado['auto_conciliadas']} conciliada(s) automaticamente";
        }

        if ($resultado['ja_existentes'] > 0) {
            $partes[] = "{$resultado['ja_existentes']} já estavam na conciliação";
        }

        if ($resultado['fora_do_periodo'] > 0) {
            $partes[] = "{$resultado['fora_do_periodo']} fora do mês (ignoradas)";
        }

        return response()->json([
            'data' => MontarRevisaoConciliacao::executar($resultado['conciliacao']),
            'message' => 'Extrato recebido: ' . implode(', ', $partes) . '.',
            'importacao' => collect($resultado)->except('conciliacao'),
        ], 201);
    }

    public function show(Conciliacao $conciliacao)
    {
        return $this->autorizado($conciliacao, fn () => null, 'ok');
    }

    /** Exclui a conciliação (só aberta). Os lançamentos do app continuam intactos; só os vínculos somem. */
    public function destroy(Conciliacao $conciliacao)
    {
        if ($conciliacao->user_id !== Auth::id()) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($conciliacao->isFinalizada()) {
            return response()->json(['message' => 'Reabra a conciliação antes de excluí-la.'], 409);
        }

        DB::transaction(function () use ($conciliacao) {
            Transacao::whereIn('reconciliation_item_id', $conciliacao->itens()->select('id'))
                ->update(['reconciliation_item_id' => null]);
            $conciliacao->delete();
        });

        return response()->json(['message' => 'Conciliação excluída.']);
    }

    public function reconferir(Conciliacao $conciliacao)
    {
        return $this->autorizado($conciliacao, function () use ($conciliacao) {
            $r = ReconferirConciliacao::executar($conciliacao);

            return match (true) {
                $r['conciliados'] > 0 && $r['desfeitos'] > 0 => "{$r['conciliados']} linha(s) conciliada(s) e {$r['desfeitos']} vínculo(s) desfeito(s) porque o lançamento mudou.",
                $r['conciliados'] > 0 => "{$r['conciliados']} linha(s) conciliada(s) com o que foi lançado.",
                $r['desfeitos'] > 0 => "{$r['desfeitos']} vínculo(s) desfeito(s) porque o lançamento do app mudou.",
                default => 'Nada novo para conciliar.',
            };
        });
    }

    public function aceitarSugestoes(Request $request, Conciliacao $conciliacao)
    {
        $dados = $request->validate(['ids' => ['nullable', 'array'], 'ids.*' => ['integer']]);

        return $this->autorizado($conciliacao, function () use ($conciliacao, $dados) {
            $aplicados = AceitarSugestoesConciliacao::executar($conciliacao, $dados['ids'] ?? null);

            return "{$aplicados} sugestão(ões) aceita(s).";
        });
    }

    public function finalizar(Request $request, Conciliacao $conciliacao)
    {
        $dados = $request->validate(['observacao' => ['nullable', 'string', 'max:2000']]);

        return $this->autorizado($conciliacao, function () use ($conciliacao, $dados) {
            FecharConciliacao::finalizar($conciliacao, $dados['observacao'] ?? null);

            return 'Conciliação finalizada. O mês desta conta está auditado.';
        });
    }

    public function reabrir(Conciliacao $conciliacao)
    {
        return $this->autorizado($conciliacao, function () use ($conciliacao) {
            FecharConciliacao::reabrir($conciliacao);

            return 'Conciliação reaberta.';
        });
    }

    public function manterSoNoApp(Request $request, Conciliacao $conciliacao)
    {
        $dados = $request->validate([
            'chaves' => ['required', 'array', 'min:1'],
            'chaves.*' => ['string', 'max:64'],
            'note' => ['required', 'string', 'max:500'],
        ], ['note.required' => 'Diga por que o lançamento está certo mesmo sem aparecer no extrato.']);

        return $this->autorizado($conciliacao, function () use ($conciliacao, $dados) {
            $mantidos = SoNoAppConciliacao::manter($conciliacao, $dados['chaves'], $dados['note']);

            return "{$mantidos} lançamento(s) confirmado(s).";
        });
    }

    public function soNoAppPendente(Request $request, Conciliacao $conciliacao)
    {
        $dados = $request->validate(['chave' => ['required', 'string', 'max:64']]);

        return $this->autorizado($conciliacao, function () use ($conciliacao, $dados) {
            SoNoAppConciliacao::voltarParaPendente($conciliacao, $dados['chave']);

            return 'Lançamento voltou para pendente.';
        });
    }

    // -=-=-=- LINHAS DO EXTRATO -=-=-=-

    public function vincular(Request $request, Conciliacao $conciliacao, ConciliacaoItem $item)
    {
        $dados = $request->validate([
            'chave' => ['required', 'string', 'max:64'],
            'ajustar_valor' => ['nullable', 'boolean'],
            'ajustar_data' => ['nullable', 'boolean'],
        ]);

        return $this->autorizado($conciliacao, function () use ($item, $dados) {
            ResolverItemConciliacao::vincular($item, $dados['chave'], (bool) ($dados['ajustar_valor'] ?? false), (bool) ($dados['ajustar_data'] ?? false));

            return 'Linha conciliada.';
        }, item: $item);
    }

    public function lancar(Request $request, Conciliacao $conciliacao, ConciliacaoItem $item)
    {
        $dados = $request->validate([
            'description' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->where('user_id', Auth::id())],
            'category_name' => ['nullable', 'string', 'max:100'],
            'budget_id' => ['nullable', 'integer', Rule::exists('budgets', 'id')->where('user_id', Auth::id())],
        ]);

        return $this->autorizado($conciliacao, function () use ($item, $dados) {
            ResolverItemConciliacao::lancar($item, $this->comCategoria($dados));

            return 'Lançado e conciliado.';
        }, item: $item);
    }

    public function transferencia(Request $request, Conciliacao $conciliacao, ConciliacaoItem $item)
    {
        $dados = $request->validate([
            'conta_id' => ['required', 'integer', Rule::exists('accounts', 'id')->where('user_id', Auth::id())],
            'description' => ['nullable', 'string', 'max:255'],
        ], ['conta_id.required' => 'Escolha a outra conta da transferência.']);

        return $this->autorizado($conciliacao, function () use ($item, $dados) {
            $transferencia = ResolverItemConciliacao::transferir($item, (int) $dados['conta_id'], $dados['description'] ?? null);
            $outra = (int) $transferencia->from_account_id === (int) $item->conciliacao->account_id
                ? $transferencia->contaDestino
                : $transferencia->contaOrigem;

            return "Transferência lançada e conferida. O lado de {$outra?->name} casa sozinho na conciliação dessa conta.";
        }, item: $item);
    }

    public function pagamentoFatura(Request $request, Conciliacao $conciliacao, ConciliacaoItem $item)
    {
        $dados = $request->validate([
            'invoice_id' => ['required', 'integer'],
            'ajuste_descricao' => ['nullable', 'string', 'max:255'],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->where('user_id', Auth::id())],
            'category_name' => ['nullable', 'string', 'max:100'],
        ]);

        return $this->autorizado($conciliacao, function () use ($item, $dados) {
            $fatura = Fatura::where('user_id', Auth::id())->find($dados['invoice_id']);

            if (!$fatura) {
                throw new ConciliacaoException('Fatura não encontrada.', 404);
            }

            $r = ResolverPagamentoFaturaConciliacao::executar($item, $fatura, $this->comCategoria($dados));

            return match ($r['acao']) {
                'PAGA' => 'Fatura marcada como paga e conciliada.',
                'PAGA_PARCIAL' => 'Pagamento parcial registrado: R$ ' . self::moeda($r['levado']) . ' foram para a próxima fatura.',
                'AJUSTADA_E_PAGA' => 'Lançado ajuste de R$ ' . self::moeda($r['ajuste']) . ' na fatura, que foi paga e conciliada.',
                'AJUSTADA' => 'Lançado ajuste de R$ ' . self::moeda(abs($r['ajuste'])) . ' na fatura e conciliado.',
                default => 'Pagamento da fatura conciliado.',
            };
        }, item: $item);
    }

    public function adiar(Request $request, Conciliacao $conciliacao, ConciliacaoItem $item)
    {
        $dados = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        return $this->autorizado($conciliacao, function () use ($item, $dados) {
            ResolverItemConciliacao::adiar($item, $dados['note'] ?? null);

            return 'Linha adiada. Você será lembrado até resolvê-la.';
        }, item: $item);
    }

    public function ignorar(Request $request, Conciliacao $conciliacao, ConciliacaoItem $item)
    {
        $dados = $request->validate(
            ['note' => ['required', 'string', 'max:500']],
            ['note.required' => 'Diga por que esta linha não entra no app (fica registrado na auditoria).']
        );

        return $this->autorizado($conciliacao, function () use ($item, $dados) {
            ResolverItemConciliacao::ignorar($item, $dados['note']);

            return 'Linha ignorada.';
        }, item: $item);
    }

    public function desfazer(Conciliacao $conciliacao, ConciliacaoItem $item)
    {
        return $this->autorizado($conciliacao, function () use ($item) {
            ResolverItemConciliacao::desfazer($item);

            return 'Desfeito.';
        }, item: $item);
    }

    // -=-=-=- APOIO -=-=-=-

    /**
     * Confere dono (e que o item é da conciliação), executa a ação e devolve a revisão atualizada.
     * A ação devolve a mensagem de sucesso.
     */
    private function autorizado(Conciliacao $conciliacao, Closure $acao, ?string $mensagemPadrao = null, ?ConciliacaoItem $item = null): JsonResponse
    {
        if ($conciliacao->user_id !== Auth::id() || ($item && $item->reconciliation_id !== $conciliacao->id)) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        try {
            $mensagem = $acao() ?? $mensagemPadrao;
        } catch (ConciliacaoException $e) {
            return $this->erro($e);
        }

        $resposta = ['data' => MontarRevisaoConciliacao::executar($conciliacao->fresh())];

        if ($mensagem && $mensagem !== 'ok') {
            $resposta['message'] = $mensagem;
        }

        return response()->json($resposta);
    }

    private function erro(ConciliacaoException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage(), ...$e->dados], $e->status);
    }

    private function comCategoria(array $dados): array
    {
        if (empty($dados['category_id']) && !empty($dados['category_name'])) {
            $dados['category_id'] = Categoria::firstOrCreate(['user_id' => Auth::id(), 'name' => $dados['category_name']])->id;
        }

        return $dados;
    }

    private static function moeda(float $valor): string
    {
        return number_format($valor, 2, ',', '.');
    }
}
