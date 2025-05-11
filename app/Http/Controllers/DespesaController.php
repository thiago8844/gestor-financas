<?php

namespace App\Http\Controllers;

use App\Http\Requests\Despesa;
use App\Http\Requests\DespesaRequest;
use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Orcamento;
use App\Models\Transacao;
use Illuminate\Http\Request;

class DespesaController extends Controller
{
    
    public function index() {

        $despesas = Transacao::where('user_id', auth()->user()->id)
            ->where('tipo', 'saida')
           //->with(['conta', 'categoria'])
            ->get();


        return view('despesa.index', compact('despesas'));
    }

    public function create() {

        $contas = Conta::where('user_id', auth()->user()->id)
            ->where('ativo', true)
            ->get();

        $categorias = Categoria::where('user_id', auth()->user()->id)
            ->where('tipo', 'despesa')
            ->get();

        $orcamentos = Orcamento::where('user_id', auth()->user()->id)
            ->get();

        return view('despesa.cadastrar', compact('contas', 'categorias', 'orcamentos'));
    }

    public function edit($id) {

    }

    public function store(DespesaRequest $request) {

        //DespesaRequest 
        $dataTransacao = \DateTime::createFromFormat('d/m/Y H:i', $request['data']);

        $despesa = Transacao::create([
            'conta_id' => $request['conta'],
            'categoria_id' => $request['categoria'],
            'user_id' => auth()->user()->id,
            'valor' => $request['valor'],
            'descricao' => $request['descricao'],
            'data' => $dataTransacao->format('Y-m-d H:i:s'),
            'tipo' => 'saida',
        ]);

        return redirect()->route('despesas.index')->with('success', 'Despesa cadastrada com sucesso!');
    }
}
