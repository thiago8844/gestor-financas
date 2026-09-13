<?php

namespace App\Http\Controllers;

use App\Actions\Ofx\ConfirmarImportacaoOfx;
use App\Actions\Ofx\DesfazerImportacaoOfx;
use App\Actions\Ofx\Exceptions\OfxArquivoDuplicadoException;
use App\Actions\Ofx\Exceptions\OfxContaNaoInformadaException;
use App\Actions\Ofx\Exceptions\OfxDesfazerBloqueadoException;
use App\Actions\Ofx\Exceptions\OfxImportacaoJaFinalizadaException;
use App\Actions\Ofx\ImportarArquivoOfx;
use App\Enums\OfxImportItemStatus;
use App\Enums\OfxImportStatus;
use App\Http\Requests\Ofx\AtualizarItemOfxRequest;
use App\Http\Requests\Ofx\AtualizarItensEmMassaOfxRequest;
use App\Http\Requests\Ofx\ConfirmarImportacaoOfxRequest;
use App\Http\Requests\Ofx\ImportarOfxRequest;
use App\Http\Resources\Ofx\OfxImportItemResource;
use App\Http\Resources\Ofx\OfxImportResource;
use App\Models\OfxImport;
use App\Models\OfxImportItem;
use App\Support\Ofx\Exceptions\OfxParseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ImportacaoOfxController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $importacoes = OfxImport::with('conta')
            ->where('user_id', Auth::id())
            ->orderByDesc('created_at')
            ->get();

        return OfxImportResource::collection($importacoes);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $importacao = OfxImport::with(['conta', 'itens.categoria', 'itens.orcamento', 'itens.conta'])->find($id);

        if (!$importacao || Auth::id() !== $importacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        return OfxImportResource::make($importacao);
    }

    /**
     * Store a newly created resource in storage (faz o upload e o parse do OFX).
     */
    public function store(ImportarOfxRequest $request)
    {
        try {
            $importacao = ImportarArquivoOfx::executar(
                Auth::id(),
                $request->file('arquivo'),
                $request->integer('conta_id') ?: null,
                $request->boolean('lembrar_conta')
            );
        } catch (OfxArquivoDuplicadoException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'importacao_existente' => OfxImportResource::make($e->importacaoExistente),
            ], 409);
        } catch (OfxContaNaoInformadaException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'necessita_conta' => true,
                'banco_detectado' => [
                    'bank_id' => $e->arquivo->bankId,
                    'branch_id' => $e->arquivo->branchId,
                    'acct_id' => $e->arquivo->acctId,
                    'acct_type' => $e->arquivo->acctType,
                ],
            ], 422);
        } catch (OfxParseException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return OfxImportResource::make($importacao->load(['itens', 'conta']))
            ->additional(['message' => 'Extrato importado e pronto para revisão'])
            ->response()
            ->setStatusCode(201);
    }

    /**
     * Update one staged item (revisão inline).
     */
    public function atualizarItem(AtualizarItemOfxRequest $request, string $importacaoId, string $itemId)
    {
        $item = OfxImportItem::find($itemId);

        if (!$item || Auth::id() !== $item->user_id || (string) $item->ofx_import_id !== $importacaoId) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($item->status !== OfxImportItemStatus::PENDENTE) {
            return response()->json(['message' => 'Só é possível editar itens pendentes.'], 422);
        }

        $item->update($request->only(['descricao', 'account_id', 'category_id', 'budget_id', 'selecionada']));

        return OfxImportItemResource::make($item->fresh(['categoria', 'orcamento', 'conta']));
    }

    /**
     * Update multiple staged items at once (edição em massa).
     */
    public function atualizarItensEmMassa(AtualizarItensEmMassaOfxRequest $request, string $importacaoId)
    {
        $dados = array_filter(
            $request->only(['account_id', 'category_id', 'budget_id', 'selecionada']),
            fn ($valor) => !is_null($valor)
        );

        $atualizados = OfxImportItem::where('ofx_import_id', $importacaoId)
            ->where('user_id', Auth::id())
            ->where('status', OfxImportItemStatus::PENDENTE)
            ->whereIn('id', $request->input('ids'))
            ->update($dados);

        return response()->json(['message' => 'Itens atualizados com sucesso', 'atualizados' => $atualizados]);
    }

    /**
     * Confirma a importação: cria as transações reais a partir dos itens selecionados.
     */
    public function confirmar(ConfirmarImportacaoOfxRequest $request, string $id)
    {
        $importacao = OfxImport::find($id);

        if (!$importacao || Auth::id() !== $importacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        try {
            $importacao = ConfirmarImportacaoOfx::executar($importacao, $request->input('ids'));
        } catch (OfxImportacaoJaFinalizadaException $e) {
            return response()->json(['message' => $e->getMessage()], 409);
        }

        return OfxImportResource::make($importacao)->additional(['message' => 'Importação confirmada com sucesso']);
    }

    /**
     * Desfaz uma importação já confirmada, apagando as transações criadas por ela.
     */
    public function desfazer(Request $request, string $id)
    {
        $importacao = OfxImport::find($id);

        if (!$importacao || Auth::id() !== $importacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        try {
            $importacao = DesfazerImportacaoOfx::executar($importacao, $request->boolean('forcar'));
        } catch (OfxDesfazerBloqueadoException $e) {
            return response()->json([
                'message' => $e->getMessage(),
                'transacoes_editadas' => $e->transacoesEditadas->pluck('id'),
            ], 409);
        }

        return OfxImportResource::make($importacao)->additional(['message' => 'Importação desfeita com sucesso']);
    }

    /**
     * Remove uma importação ainda não confirmada (abandonada).
     */
    public function cancelar(string $id)
    {
        $importacao = OfxImport::find($id);

        if (!$importacao || Auth::id() !== $importacao->user_id) {
            return response()->json(['message' => 'Acesso negado'], 403);
        }

        if ($importacao->status !== OfxImportStatus::STAGED) {
            return response()->json(['message' => 'Só é possível cancelar importações ainda não confirmadas.'], 422);
        }

        $importacao->delete();

        return response()->json(['message' => 'Importação cancelada com sucesso']);
    }
}
