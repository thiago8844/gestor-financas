<?php

namespace App\Http\Controllers;

use App\Actions\Emprestimos\AjustarEmprestimo;
use App\Actions\Emprestimos\BaixarParcela;
use App\Actions\Emprestimos\CancelarEmprestimo;
use App\Actions\Emprestimos\CriarEmprestimo;
use App\Actions\Emprestimos\EncerrarEmprestimo;
use App\Actions\Emprestimos\ExcluirEmprestimo;
use App\Actions\Emprestimos\ReverterBaixa;
use App\Http\Requests\Emprestimos\AjusteEmprestimoRequest;
use App\Http\Requests\Emprestimos\BaixarParcelaRequest;
use App\Http\Requests\Emprestimos\EmprestimoRequest;
use App\Http\Resources\EmprestimoParcelaResource;
use App\Http\Resources\EmprestimoResource;
use App\Models\Emprestimo;
use App\Models\EmprestimoEvento;
use App\Models\EmprestimoParcela;
use App\Queries\Emprestimos\ResumoEmprestimosQuery;
use App\Support\Emprestimos\CalculadoraAjuste;
use App\Support\Emprestimos\ContratoEmprestimo;
use App\Support\Emprestimos\GeradorCronograma;
use DomainException;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\Auth;
use InvalidArgumentException;

class EmprestimoController extends Controller
{
    public function index(Request $request)
    {
        $query = Emprestimo::with(['parcelas', 'conta:id,name', 'categoria:id,name'])
            ->where('user_id', Auth::id());

        if ($request->filled('direction')) {
            $query->where('direction', $request->direction);
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $emprestimos = $query->orderByRaw("CASE status WHEN 'ATIVO' THEN 0 ELSE 1 END")
            ->orderByDesc('contract_date')
            ->get();

        // Filtro de atrasados é sobre as parcelas, então roda depois de carregá-las.
        if ($request->boolean('overdue')) {
            $emprestimos = $emprestimos
                ->filter(fn (Emprestimo $e) => $e->parcelas->contains(fn (EmprestimoParcela $p) => $p->atrasada()))
                ->values();
        }

        return EmprestimoResource::collection($emprestimos);
    }

    public function resumo()
    {
        return response()->json(['data' => ResumoEmprestimosQuery::para(Auth::id())]);
    }

    /**
     * Calcula o cronograma sem gravar nada (prévia ao vivo do cadastro).
     */
    public function previa(EmprestimoRequest $request)
    {
        try {
            $parcelas = (new GeradorCronograma())->gerar(ContratoEmprestimo::dosDados($request->validated()));
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $parcelas = collect($parcelas);

        return response()->json(['data' => [
            'open_term' => ContratoEmprestimo::dosDados($request->validated())->prazoAberto(),
            'total_interest' => round($parcelas->sum('valor_juros'), 2),
            'total_amount' => round($parcelas->sum('valor_previsto'), 2),
            'installments' => $parcelas->map(fn (array $p) => [
                'number' => $p['numero'],
                'due_date' => $p['vencimento']->toDateString(),
                'principal_amount' => $p['valor_principal'],
                'interest_amount' => $p['valor_juros'],
                'expected_amount' => $p['valor_previsto'],
            ])->values(),
        ]]);
    }

    public function store(EmprestimoRequest $request)
    {
        try {
            $emprestimo = CriarEmprestimo::executar(Auth::id(), $request->validated());
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return EmprestimoResource::make($emprestimo)
            ->additional(['message' => 'Empréstimo criado com sucesso'])
            ->response()
            ->setStatusCode(201);
    }

    public function show(Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        return EmprestimoResource::make($emprestimo->load(['parcelas', 'conta:id,name', 'categoria:id,name']));
    }

    /**
     * Só dados de identificação e padrões de lançamento. O cronograma não é editável: para mudar
     * valor, taxa ou prazo, exclua e crie de novo (ou use a renegociação, quando existir).
     */
    public function update(Request $request, Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        $dados = $request->validate([
            'counterparty' => 'sometimes|required|string|max:150',
            'description' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
            'account_id' => ['nullable', 'integer', \Illuminate\Validation\Rule::exists('accounts', 'id')->where('user_id', Auth::id())],
            'category_id' => ['nullable', 'integer', \Illuminate\Validation\Rule::exists('categories', 'id')->where('user_id', Auth::id())],
        ]);

        $emprestimo->update($dados);

        return EmprestimoResource::make($emprestimo->load(['parcelas', 'conta:id,name', 'categoria:id,name']))
            ->additional(['message' => 'Empréstimo atualizado com sucesso']);
    }

    public function destroy(Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        ExcluirEmprestimo::executar($emprestimo);

        return response()->json(['message' => 'Empréstimo excluído com sucesso'], 200);
    }

    public function baixar(BaixarParcelaRequest $request, Emprestimo $emprestimo, EmprestimoParcela $parcela)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo, $parcela)) {
            return $negado;
        }

        try {
            $parcela = BaixarParcela::executar($emprestimo, $parcela, $request->validated());
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return EmprestimoParcelaResource::make($parcela)
            ->additional(['message' => 'Pagamento registrado com sucesso']);
    }

    public function reverter(Emprestimo $emprestimo, EmprestimoParcela $parcela)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo, $parcela)) {
            return $negado;
        }

        try {
            $parcela = ReverterBaixa::executar($emprestimo, $parcela);
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return EmprestimoParcelaResource::make($parcela)
            ->additional(['message' => 'Pagamento revertido com sucesso']);
    }

    /**
     * Registra que uma parcela venceu sem ser paga. Não altera valores: ela continua em aberto
     * (e atrasada) até ser baixada. Serve de histórico e de lembrete da cobrança.
     */
    public function naoPaga(Request $request, Emprestimo $emprestimo, EmprestimoParcela $parcela)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo, $parcela)) {
            return $negado;
        }

        if (!$parcela->emAberto()) {
            return response()->json(['message' => 'Esta parcela não está em aberto.'], 422);
        }

        $dados = $request->validate(['note' => 'nullable|string|max:255']);

        EmprestimoEvento::registrar(
            $emprestimo,
            'parcela_nao_paga',
            "Parcela {$parcela->number} registrada como não paga" . (!empty($dados['note']) ? ": {$dados['note']}" : ''),
            $parcela->id,
        );

        return response()->json(['message' => 'Ocorrência registrada'], 200);
    }

    public function encerrar(Request $request, Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        $dados = $request->validate(['date' => 'required|date']);

        try {
            $emprestimo = EncerrarEmprestimo::executar($emprestimo, $dados['date']);
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return EmprestimoResource::make($emprestimo->load(['conta:id,name', 'categoria:id,name']))
            ->additional(['message' => 'Encerramento definido com sucesso']);
    }

    /**
     * Mostra o efeito de uma amortização extra ou de um aumento sem gravar nada.
     */
    public function simularAjuste(AjusteEmprestimoRequest $request, Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        $dados = $request->validated();
        $calculadora = new CalculadoraAjuste();

        try {
            $plano = $calculadora->calcular(
                $emprestimo->load('ajustes'),
                $dados['type'],
                (float) $dados['amount'],
                Carbon::parse($dados['date'] ?? now()),
                $dados['mode'] ?? CalculadoraAjuste::MANTER_PRAZO,
                $dados['installments'] ?? null,
            );
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['data' => $calculadora->resumo($emprestimo, $plano)]);
    }

    public function ajustar(AjusteEmprestimoRequest $request, Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        try {
            $emprestimo = AjustarEmprestimo::executar($emprestimo->load('ajustes'), $request->validated());
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return EmprestimoResource::make($emprestimo)
            ->additional(['message' => $request->input('type') === 'AMORTIZACAO' ? 'Amortização registrada com sucesso' : 'Empréstimo aumentado com sucesso']);
    }

    /**
     * Cancela o contrato mantendo histórico e lançamentos (ver CancelarEmprestimo).
     */
    public function cancelar(Request $request, Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        $dados = $request->validate(['reason' => 'nullable|string|max:200']);

        try {
            $emprestimo = CancelarEmprestimo::executar($emprestimo, $dados['reason'] ?? null);
        } catch (DomainException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return EmprestimoResource::make($emprestimo)->additional(['message' => 'Empréstimo cancelado com sucesso']);
    }

    /**
     * Lançamentos que o empréstimo gerou nas contas: o valor emprestado, cada pagamento de parcela
     * e as amortizações/aumentos. É daqui que dá para conferir o que mexeu no saldo.
     */
    public function lancamentos(Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        $idsDeAjuste = $emprestimo->ajustes()->reorder()->whereNotNull('transaction_id')->pluck('transaction_id')->all();

        $lancamentos = $emprestimo->transacoes()
            ->with('conta:id,name')
            ->orderByRaw('COALESCE(date, due_date, created_at) desc')
            ->orderByDesc('id')
            ->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'description' => $t->description,
                'type' => $t->type,
                'status' => $t->status,
                'amount' => (float) $t->amount,
                'date' => ($t->date ?? $t->due_date)?->toDateString(),
                'account' => $t->conta ? ['id' => $t->conta->id, 'name' => $t->conta->name] : null,
                'installment_id' => $t->loan_installment_id,
                'kind' => $t->loan_installment_id ? 'PARCELA' : (in_array($t->id, $idsDeAjuste, true) ? 'AJUSTE' : 'PRINCIPAL'),
            ]);

        return response()->json(['data' => $lancamentos]);
    }

    public function historico(Emprestimo $emprestimo)
    {
        if ($negado = $this->negarSeNaoForDono($emprestimo)) {
            return $negado;
        }

        return response()->json(['data' => $emprestimo->eventos()->get(['id', 'installment_id', 'type', 'message', 'data', 'created_at'])]);
    }

    private function negarSeNaoForDono(Emprestimo $emprestimo, ?EmprestimoParcela $parcela = null)
    {
        if (Auth::id() !== $emprestimo->user_id || ($parcela && $parcela->loan_id !== $emprestimo->id)) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        return null;
    }
}
