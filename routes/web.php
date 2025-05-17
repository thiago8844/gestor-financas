<?php

use App\Http\Controllers\CadastroController;
use App\Http\Controllers\ContasController;
use App\Http\Controllers\DespesaController;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\ReceitaController;
use Illuminate\Support\Facades\Route;


//Usuário
Route::middleware('guest')->group(function () {
    Route::get('/login', function () {
        return view('usuario.login');
    })->name('login');
    route::post('/login', [LoginController::class, 'login']);
    route::post('/cadastro', [CadastroController::class, 'store']);
    Route::get('/cadastro', function () {
        return view('usuario.cadastro');
    });
});

Route::middleware('auth')->group(function () {

    Route::get('/', function() {
        return view('dashboard');
    })->middleware('auth')->name('dashboard');

    route::post('/logout', [LoginController::class, 'logout'])->name('logout');

    //Contas
    Route::get('/contas/cadastrar', [ContasController::class, 'create'])->name('contas.cadastrar');
    Route::get('/contas', [ContasController::class, 'index'])->name('contas.index');
    Route::post('/contas/cadastrar', [ContasController::class, 'store'])->name('contas.criar');


    //Despesas
    Route::get('/despesas', [DespesaController::class, 'index'])->name('despesas.index');
    Route::get('/despesas/cadastrar', [DespesaController::class, 'create'])->name('despesas.create');
    Route::get('/despesas/editar/{id}', [DespesaController::class, 'edit'])->name('despesas.edit');
    Route::post('/despesas/cadastrar', [DespesaController::class, 'store'])->name('despesas.store');
    Route::put('/despesas/editar/{id}', [DespesaController::class, 'update'])->name('despesas.update');
    Route::delete('/despesas/deletar/{id}', [DespesaController::class, 'destroy'])->name('despesas.destroy');


    //Receitas
    Route::get('/receitas', [ReceitaController::class, 'index'])->name('receitas.index');
    
});

