<?php


namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class CadastroController extends Controller {

  public function store(Request $request) {
    
    //O próprio objeto do request tem o validator embutido
    $request->validate([
      'nome' => ['required', 'string', 'max:255'],
      'email' => ['required', 'email', 'max:255'],
      'password' => ['required', 'min:3', 'confirmed'],
    ]);

    $user = User::create([
      "name" => $request->nome,
      "email" => $request->email,
      "password" => Hash::make($request->password),
    ]);

    Auth::login($user);

    return redirect()->route('dashboard');

  }

}