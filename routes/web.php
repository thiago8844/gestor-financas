<?php

use App\Http\Controllers\CadastroController;
use App\Http\Controllers\ContasController;
use App\Http\Controllers\LoginController;
use Illuminate\Support\Facades\Route;


Route::get('/', function() {
    return view('dashboard');
})->middleware('auth')->name('dashboard');

//Usuário
Route::get('/login', function () {
    return view('usuario.login');
})->name('login');
route::post('/login', [LoginController::class, 'login']);
route::post('/logout', [LoginController::class, 'logout']);

Route::get('/cadastro', function () {
    return view('usuario.cadastro');
});
route::post('/cadastro', [CadastroController::class, 'store']);



//Contas
Route::get('/contas/cadastrar', [ContasController::class, 'create'])->name('contas.cadastrar');
Route::post('/contas/cadastrar', [ContasController::class, 'store'])->name('contas.criar');