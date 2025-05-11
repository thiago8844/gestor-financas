<?php

namespace App\Http\Controllers;

use App\Models\Conta;
use App\Models\Transacao;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContasController extends Controller
{
    public function index() {
        $contas = Conta::where('user_id', auth()->user()->id)
            ->get();

        return view('contas.index', compact('contas'));
    }

    public function create() {
        return view('contas.cadastrar');
    }

    public function store() {
      
        $data = request()->validate([
            'nome' => 'required|string|max:255',
            'saldo' => 'required|numeric|min:0',
        ]);
        DB::beginTransaction();

        $conta = Conta::create([
            'nome' => $data['nome'],
            'user_id' => auth()->user()->id,
            'ativo' => true,
        ]);

        $saldoInicial = (float) $data['saldo'];
        
        if($saldoInicial > 0) {
            Transacao::create([
                'conta_id' => $conta->id,
                'valor' => $saldoInicial,
                'tipo' => 'entrada',
                'descricao' => "Saldo inicial da conta {$conta->nome}",
                'data' => now(),
                'user_id' => auth()->user()->id,
            ]);
        }

        DB::commit();

        return redirect()->route('contas.index')->with('success', 'Conta criada com sucesso!');
    }

    
}
