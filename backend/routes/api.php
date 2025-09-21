<?php

use App\Http\Controllers\Auth\RegisteredUserController;
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
});


Route::post('/login', [\App\Http\Controllers\Auth\AuthenticatedSessionController::class, 'store'])
    ->name('login');
Route::post('/cadastro', [RegisteredUserController::class, 'store'])
    ->name('register');
