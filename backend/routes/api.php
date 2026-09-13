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
    });


    //CONTAS
    Route::get('/contas', [ContaController::class, 'index']);
    Route::get('/contas/{conta}', [ContaController::class, 'show']);
    Route::post('/contas/criar', [ContaController::class, 'store']);
    Route::put('/contas/atualizar/{conta}', [ContaController::class, 'update']);
    Route::delete('/contas/deletar/{conta}', [ContaController::class, 'destroy']);

    //TRANSACOES
    Route::get('/transacoes', [\App\Http\Controllers\TransacaoController::class, 'index']);
    Route::get('/transacoes/grupos-parcelados', [\App\Http\Controllers\TransacaoController::class, 'gruposParcelados']);
    Route::get('/transacoes/{id}', [\App\Http\Controllers\TransacaoController::class, 'show']);
    Route::post('/transacoes/criar', [\App\Http\Controllers\TransacaoController::class, 'store']);
    Route::post('/transacoes/parceladas', [\App\Http\Controllers\TransacaoController::class, 'storeParcelado']);
    Route::put('/transacoes/atualizar/{transacao}', [\App\Http\Controllers\TransacaoController::class, 'update']);
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
    Route::delete('/importacoes-ofx/{id}/cancelar', [\App\Http\Controllers\ImportacaoOfxController::class, 'cancelar']);
    Route::patch('/importacoes-ofx/{importacao}/itens/em-massa', [\App\Http\Controllers\ImportacaoOfxController::class, 'atualizarItensEmMassa']);
    Route::patch('/importacoes-ofx/{importacao}/itens/{item}', [\App\Http\Controllers\ImportacaoOfxController::class, 'atualizarItem']);

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
