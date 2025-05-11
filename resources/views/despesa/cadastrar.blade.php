@extends('layouts.main')

@push('styles')

  <style>

  </style>

@endpush

@section('content')

<main class=" mx-auto vh-100 p-4" style="max-width: 1200px">



  <form x-data action="{{route('despesas.store')}}" method="POST">
    @csrf

    
    <div class="row mb-4">
      <div class="col-12">
        <h1>Criar Despesa</h1>
      </div>
    </div>

    <x-errors/>


    <div class="row mt-2">
      <div class="col-6">

        <div class="form-group mb-3">
          <label for="descricao">Descrição:</label>
          <input id="descricao" name="descricao" value="{{old('descricao')}}" type="text" class="form-control form-control-sm">
        </div>

        <div class="form-group mb-3">
          <label for="conta">Conta:</label>
          <select name="conta" id="conta" class="form-select form-select-sm">
            @foreach($contas as $conta)
              <option value="{{$conta->id}}">{{$conta->nome}}</option>
            @endforeach
          </select>
        </div>

        <div class="form-group mb-3">
          <label for="data">Data:</label>
          <input id="data" name="data" value="{{old('descricao')}}" type="text" class="form-control form-control-sm date-time">
        </div>

      </div>

      <div class="col-6">

        <div class="form-group mb-3">
          <label for="valor">Valor:</label>
              <input 
              x-init="createMoneyMask($el)"
              @input="$refs.valor.value = currencyToNumber($el.value)" 
              id="valor" type="text" class="form-control form-control-sm" value="{{old('valor')}}">
              <input type="hidden" name="valor" x-ref="valor" value="{{old('valor')}}">
        </div>

        <div class="form-group mb-3">
          <label for="categoria">Categoria:</label>
          <input id="categoria" name="categoria" value="{{old('categoria')}}" type="text" class="form-control form-control-sm">
        </div>

        <div class="form-group mb-3">
          <label for="orcamento">Orçamento:</label>
          <select name="orcamento" id="orcamento" class="form-select form-select-sm">
            <option value="">Selecione</option>
            @foreach($orcamentos as $orcamento)
              <option value="{{$orcamento->id}}">{{$orcamento->nome}}</option>
            @endforeach
          </select>
        </div>

      </div>

    </div>

    <div class="d-flex justify-content-end">
      <button type="submit" class="btn btn-success">Cadastrar</button>
    </div>

  </form>

</main>

@endsection