<?php

namespace App\Http\Controllers;

use App\Models\Conta;
use Illuminate\Http\Request;

class ContasController extends Controller
{
    
    public function create() {
        return view('contas.cadastrar');
    }

    public function store() {
      
        $data = request()->validate([
            'nome' => 'required|string|max:255',
            'saldo' => 'required|numeric|min:0',
        ]);

        dd(request()->all());

        Conta::create([
            'nome' => $data['nome'],
            'ativo' => true,
        ]);

        return redirect()->route('dashboard')->with('success', 'Conta criada com sucesso!');
    }
}
