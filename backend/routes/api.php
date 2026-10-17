<?php


use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\ContaController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;


Route::middleware(['auth:sanctum'])->group(function () {

    Route::post('/logout', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'destroy'])
        ->name('logout');

    Route::get('/user', function (Request $request) {
        //sleep(2);
        $user = $request->user();
        return response()->json(['user' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ]], 200);
    });

    //DASHBOARD
    Route::prefix('dashboard')->group(function () {
        Route::get('/indicadores',          [\App\Http\Controllers\DashboardController::class, 'indicadores']);
        Route::get('/saldo-contas',         [\App\Http\Controllers\DashboardController::class, 'saldoContas']);
        Route::get('/transacoes-categoria', [\App\Http\Controllers\DashboardController::class, 'transacoesCategoria']);
        Route::get('/fatura-atual', [\App\Http\Controllers\DashboardController::class, 'faturaAtual']);
        Route::get('/despesas-futuras',     [\App\Http\Controllers\DashboardController::class, 'despesasFuturas']);
    });


    //RELATORIOS
    Route::get('/relatorios/fluxo-de-caixa', [\App\Http\Controllers\RelatorioController::class, 'fluxoCaixa']);
    Route::get('/relatorios/resultado-financeiro', [\App\Http\Controllers\RelatorioController::class, 'resultadoFinanceiro']);
    Route::get('/relatorios/analise-gastos', [\App\Http\Controllers\RelatorioController::class, 'analiseGastos']);
    Route::get('/relatorios/compromissos-futuros', [\App\Http\Controllers\RelatorioController::class, 'compromissosFuturos']);
    // POST: o cenário (ajustes e eventos hipotéticos) é um JSON aninhado; nada é gravado.
    Route::post('/relatorios/simulador-financeiro', [\App\Http\Controllers\RelatorioController::class, 'simuladorFinanceiro']);
    Route::get('/relatorios/simulador-financeiro/cenarios', [\App\Http\Controllers\CenarioSimuladorController::class, 'index']);
    Route::post('/relatorios/simulador-financeiro/cenarios', [\App\Http\Controllers\CenarioSimuladorController::class, 'store']);
    Route::put('/relatorios/simulador-financeiro/cenarios/{cenario}', [\App\Http\Controllers\CenarioSimuladorController::class, 'update']);
    Route::delete('/relatorios/simulador-financeiro/cenarios/{cenario}', [\App\Http\Controllers\CenarioSimuladorController::class, 'destroy']);

    //CONTAS
    Route::get('/contas', [ContaController::class, 'index']);
    Route::get('/contas/{conta}', [ContaController::class, 'show']);
    Route::post('/contas/criar', [ContaController::class, 'store']);
    Route::put('/contas/atualizar/{conta}', [ContaController::class, 'update']);
    Route::delete('/contas/deletar/{conta}', [ContaController::class, 'destroy']);

    //TRANSFERENCIAS
    Route::get('/transferencias', [\App\Http\Controllers\TransferenciaController::class, 'index']);
    Route::get('/transferencias/{transferencia}', [\App\Http\Controllers\TransferenciaController::class, 'show']);
    Route::post('/transferencias/criar', [\App\Http\Controllers\TransferenciaController::class, 'store']);
    Route::put('/transferencias/atualizar/{transferencia}', [\App\Http\Controllers\TransferenciaController::class, 'update']);
    Route::delete('/transferencias/deletar/{transferencia}', [\App\Http\Controllers\TransferenciaController::class, 'destroy']);

    //CARTOES
    Route::get('/cartoes', [\App\Http\Controllers\CartaoController::class, 'index']);
    Route::get('/cartoes/{cartao}', [\App\Http\Controllers\CartaoController::class, 'show']);
    Route::post('/cartoes/criar', [\App\Http\Controllers\CartaoController::class, 'store']);
    Route::put('/cartoes/atualizar/{cartao}', [\App\Http\Controllers\CartaoController::class, 'update']);
    Route::delete('/cartoes/deletar/{cartao}', [\App\Http\Controllers\CartaoController::class, 'destroy']);
    Route::get('/cartoes/{cartao}/faturas', [\App\Http\Controllers\FaturaController::class, 'porCartao']);

    //FATURAS
    Route::post('/faturas/{fatura}/pagar', [\App\Http\Controllers\FaturaController::class, 'pagar']);
    Route::post('/faturas/{fatura}/reverter', [\App\Http\Controllers\FaturaController::class, 'reverter']);
    Route::post('/faturas/{fatura}/lancamentos', [\App\Http\Controllers\FaturaController::class, 'lancar']);
    Route::get('/faturas/{fatura}/auditorias', [\App\Http\Controllers\FaturaController::class, 'auditorias']);
    Route::post('/faturas/{fatura}/auditorias', [\App\Http\Controllers\FaturaController::class, 'auditar']);

    //TRANSACOES
    Route::get('/transacoes', [\App\Http\Controllers\TransacaoController::class, 'index']);
    Route::get('/transacoes/grupos-parcelados', [\App\Http\Controllers\TransacaoController::class, 'gruposParcelados']);
    Route::get('/transacoes/{id}', [\App\Http\Controllers\TransacaoController::class, 'show']);
    Route::post('/transacoes/criar', [\App\Http\Controllers\TransacaoController::class, 'store']);
    Route::post('/transacoes/parceladas', [\App\Http\Controllers\TransacaoController::class, 'storeParcelado']);
    Route::post('/transacoes/cartao', [\App\Http\Controllers\TransacaoController::class, 'storeCartao']);
    Route::put('/transacoes/atualizar/{transacao}', [\App\Http\Controllers\TransacaoController::class, 'update']);
    Route::put('/transacoes/{transacao}/valor', [\App\Http\Controllers\TransacaoController::class, 'atualizarValor']);
    Route::delete('/transacoes/deletar-multiplas', [\App\Http\Controllers\TransacaoController::class, 'destroyMultiplas']);
    Route::delete('/transacoes/deletar/{transacao}', [\App\Http\Controllers\TransacaoController::class, 'destroy']);

    //Despesas
    Route::get('/despesas', [\App\Http\Controllers\TransacaoController::class, 'index']);
    //Receitas
    Route::get('/receitas', [\App\Http\Controllers\TransacaoController::class, 'index']);

    //RECORRENCIAS
    Route::get('/recorrencias', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'index']);
    Route::get('/recorrencias/{id}', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'show']);
    Route::post('/recorrencias/criar', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'store']);
    Route::put('/recorrencias/atualizar/{id}', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'update']);
    Route::patch('/recorrencias/{id}/alternar-ativo', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'alternarAtivo']);
    Route::get('/recorrencias/{recorrencia}/lancamentos-candidatos', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'lancamentosCandidatos']);
    Route::get('/recorrencias/{recorrencia}/lancamentos', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'lancamentosVinculados']);
    Route::post('/recorrencias/{recorrencia}/lancamentos', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'vincularLancamentos']);
    Route::delete('/recorrencias/{recorrencia}/lancamentos/{transacao}', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'desvincularLancamento']);
    Route::delete('/recorrencias/deletar/{recorrencia}', [\App\Http\Controllers\RecorrenciaTransacaoController::class, 'destroy']);

    //ORCAMENTOS
    Route::get('/orcamentos', [\App\Http\Controllers\OrcamentoController::class, 'index']);
    Route::get('/orcamentos/{id}', [\App\Http\Controllers\OrcamentoController::class, 'show']);
    Route::post('/orcamentos/criar', [\App\Http\Controllers\OrcamentoController::class, 'store']);
    Route::put('/orcamentos/atualizar/{id}', [\App\Http\Controllers\OrcamentoController::class, 'update']);
    Route::patch('/orcamentos/{id}/alternar-ativo', [\App\Http\Controllers\OrcamentoController::class, 'alternarAtivo']);
    Route::delete('/orcamentos/deletar/{orcamento}', [\App\Http\Controllers\OrcamentoController::class, 'destroy']);

    //IMPORTACAO OFX
    Route::get('/importacoes-ofx', [\App\Http\Controllers\ImportacaoOfxController::class, 'index']);
    Route::post('/importacoes-ofx', [\App\Http\Controllers\ImportacaoOfxController::class, 'store']);
    Route::get('/importacoes-ofx/{id}', [\App\Http\Controllers\ImportacaoOfxController::class, 'show']);
    Route::post('/importacoes-ofx/{id}/confirmar', [\App\Http\Controllers\ImportacaoOfxController::class, 'confirmar']);
    Route::post('/importacoes-ofx/{id}/desfazer', [\App\Http\Controllers\ImportacaoOfxController::class, 'desfazer']);
    Route::post('/importacoes-ofx/{id}/reabrir', [\App\Http\Controllers\ImportacaoOfxController::class, 'reabrir']);
    Route::delete('/importacoes-ofx/{id}/cancelar', [\App\Http\Controllers\ImportacaoOfxController::class, 'cancelar']);
    Route::patch('/importacoes-ofx/{importacao}/itens/em-massa', [\App\Http\Controllers\ImportacaoOfxController::class, 'atualizarItensEmMassa']);
    Route::patch('/importacoes-ofx/{importacao}/itens/{item}', [\App\Http\Controllers\ImportacaoOfxController::class, 'atualizarItem']);

    //CONCILIACAO BANCARIA
    Route::prefix('conciliacoes')->controller(\App\Http\Controllers\ConciliacaoController::class)->group(function () {
        Route::get('/', 'index');
        Route::get('/painel', 'painel');
        Route::post('/', 'store');
        Route::get('/{conciliacao}', 'show');
        Route::delete('/{conciliacao}', 'destroy');
        Route::post('/{conciliacao}/reconferir', 'reconferir');
        Route::post('/{conciliacao}/aceitar-sugestoes', 'aceitarSugestoes');
        Route::post('/{conciliacao}/finalizar', 'finalizar');
        Route::post('/{conciliacao}/reabrir', 'reabrir');
        Route::post('/{conciliacao}/so-no-app/manter', 'manterSoNoApp');
        Route::post('/{conciliacao}/so-no-app/pendente', 'soNoAppPendente');
        Route::post('/{conciliacao}/itens/{item}/vincular', 'vincular');
        Route::post('/{conciliacao}/itens/{item}/lancar', 'lancar');
        Route::post('/{conciliacao}/itens/{item}/pagamento-fatura', 'pagamentoFatura');
        Route::post('/{conciliacao}/itens/{item}/transferencia', 'transferencia');
        Route::post('/{conciliacao}/itens/{item}/adiar', 'adiar');
        Route::post('/{conciliacao}/itens/{item}/ignorar', 'ignorar');
        Route::post('/{conciliacao}/itens/{item}/desfazer', 'desfazer');
    });

    //REGRAS DE IMPORTACAO OFX
    Route::get('/regras-importacao-ofx', [\App\Http\Controllers\RegraImportacaoOfxController::class, 'index']);
    Route::post('/regras-importacao-ofx/criar', [\App\Http\Controllers\RegraImportacaoOfxController::class, 'store']);
    Route::post('/regras-importacao-ofx/{id}/aplicar', [\App\Http\Controllers\RegraImportacaoOfxController::class, 'aplicar']);
    Route::patch('/regras-importacao-ofx/{id}/alternar-ativo', [\App\Http\Controllers\RegraImportacaoOfxController::class, 'alternarAtivo']);
    Route::delete('/regras-importacao-ofx/deletar/{id}', [\App\Http\Controllers\RegraImportacaoOfxController::class, 'destroy']);

    //NOTIFICACOES
    Route::get('/notificacoes', [\App\Http\Controllers\NotificacaoController::class, 'index']);
    Route::patch('/notificacoes/marcar-todas-lidas', [\App\Http\Controllers\NotificacaoController::class, 'marcarTodasComoLidas']);
    Route::patch('/notificacoes/{id}/marcar-lida', [\App\Http\Controllers\NotificacaoController::class, 'marcarComoLida']);

    //CONFIGURACOES
    Route::get('/configuracoes', [\App\Http\Controllers\ConfiguracaoController::class, 'show']);
    Route::put('/configuracoes', [\App\Http\Controllers\ConfiguracaoController::class, 'update']);

    //CATEGORIAS
    Route::get('/categorias', [\App\Http\Controllers\CategoriaController::class, 'index']);
    Route::post('/categorias/criar', [\App\Http\Controllers\CategoriaController::class, 'store']);
    Route::patch('/categorias/editar/{id}', [\App\Http\Controllers\CategoriaController::class, 'update']);
    Route::delete('/categorias/delete/{id}', [\App\Http\Controllers\CategoriaController::class, 'destroy']);

    //CHATBOT
    Route::post('/chatbot', [\App\Http\Controllers\ChatbotController::class, 'chat']);
    Route::get('/prompt', \App\Http\Controllers\PromptController::class);
    Route::get('/chatbot/permission', [\App\Http\Controllers\ChatbotController::class, 'permission']);
});


Route::post('/login', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'store'])
    ->name('login');
Route::post('/cadastro', [RegisteredUserController::class, 'store'])
    ->name('register');
