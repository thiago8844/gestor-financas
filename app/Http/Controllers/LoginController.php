<?php


namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LoginController extends Controller {

  public function login(Request $request) {
    
    $tipoLogin = filter_var($request->credencial, FILTER_VALIDATE_EMAIL) ? 'email' : 'name'; //Verifica se a credencial é um email, se for vai tentar logar com e-mail, caso contrário loga com nome

    $success = Auth::attempt([$tipoLogin => $request->credencial, 'password' => $request->password]);

    if(!$success) {
      return redirect()->back()->withErrors(['login' => 'E-mail, Usuario ou senha errados.'])->withInput();
    }

    return redirect()->route('dashboard');
  }

  public function logout() {
    Auth::logout();

    return redirect()->route('login');
  }

}