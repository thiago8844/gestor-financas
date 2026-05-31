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
    Route::get('/transacoes/{id}', [\App\Http\Controllers\TransacaoController::class, 'show']);
    Route::post('/transacoes/criar', [\App\Http\Controllers\TransacaoController::class, 'store']);
    Route::put('/transacoes/atualizar/{transacao}', [\App\Http\Controllers\TransacaoController::class, 'update']);
    Route::delete('/transacoes/deletar/{transacao}', [\App\Http\Controllers\TransacaoController::class, 'destroy']);

    //Despesas
    Route::get('/despesas', [\App\Http\Controllers\TransacaoController::class, 'index']);
    //Receitas
    Route::get('/receitas', [\App\Http\Controllers\TransacaoController::class, 'index']);

    //CATEGORIAS
    Route::get('/categorias', [\App\Http\Controllers\CategoriaController::class, 'index']);
    Route::post('/categorias/criar', [\App\Http\Controllers\CategoriaController::class, 'store']);
    Route::patch('/categorias/editar/{id}', [\App\Http\Controllers\CategoriaController::class, 'update']);
    Route::delete('/categorias/delete/{id}', [\App\Http\Controllers\CategoriaController::class, 'destroy']);

    //CHATBOT
    Route::post('/chatbot', [\App\Http\Controllers\ChatbotController::class, 'chat']);
    Route::get('/prompt', \App\Http\Controllers\PromptController::class);
});


Route::post('/login', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'store'])
    ->name('login');
Route::post('/cadastro', [RegisteredUserController::class, 'store'])
    ->name('register');
