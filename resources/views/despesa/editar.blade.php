@extends('layouts.main')

@push('styles')

  <style>

  </style>

@endpush

@section('content')

<main class=" mx-auto vh-100 p-4" style="max-width: 1200px">



  <form x-data action="{{route('despesas.update', $despesa->id)}}" method="POST">
    @csrf
    @method('PUT')
    
    <div class="row mb-4">
      <div class="col-12">
        <h1>Editar Despesa</h1>
      </div>
    </div>

    <x-errors/>


    <div class="row mt-2">
      <div class="col-6">

        <div class="form-group mb-3">
          <label for="descricao">Descrição:</label>
          <input id="descricao" name="descricao" value="{{$despesa->descricao}}" type="text" class="form-control form-control-sm">
        </div>

        <div class="form-group mb-3">
          <label for="conta">Conta:</label>
          <select name="conta" id="conta" class="form-select form-select-sm">
            @foreach($contas as $conta)
              <option {{ $conta->id == $despesa->conta_id ? 'selected' : ''  }} value="{{$conta->id}}">{{$conta->nome}}</option>
            @endforeach
          </select>
        </div>

        <div class="form-group mb-3">
          <label for="data">Data: {{$despesa->date_time_br}}</label>
          <input x-init="
            flatpickr($el, {
              enableTime: true,
              dateFormat: 'd/m/Y H:i',
              time_24hr: true,
              defaultDate: '{{$despesa->date_time_br}}',
            });
          " 
          id="data" name="data" value="{{$despesa->dateTimeBr}}" type="text" class="form-control form-control-sm ">
        </div>

      </div>

      <div class="col-6">

        <div class="form-group mb-3">
          <label for="valor">Valor:</label>
              <input 
              x-init="createMoneyMask($el)"
              @input="$refs.valor.value = currencyToNumber($el.value)" 
              id="valor" type="text" class="form-control form-control-sm" value="{{$despesa->valor}}">
              <input type="hidden" name="valor" x-ref="valor" value="{{$despesa->valor}}">
        </div>

        <div class="form-group mb-3">
          <label for="categoria">Categoria:</label>
          <input id="categoria" name="categoria" value="{{ $despesa?->categoria?->nome }}" type="text" class="form-control form-control-sm">
        </div>

        <div class="form-group mb-3">
          <label for="orcamento">Orçamento:</label>
          <select name="orcamento" id="orcamento" class="form-select form-select-sm">
            <option value="">Selecione</option>
            @foreach($orcamentos as $orcamento)
              <option {{ $orcamento->id == $despesa->orcamento_id ? 'selected' : ''  }} value="{{$orcamento->id}}">{{$orcamento->nome}}</option>
            @endforeach
          </select>
        </div>

      </div>

    </div>

    <div class="d-flex justify-content-end">
      <button type="submit" class="btn btn-primary">Editar</button>
    </div>

  </form>

</main>

@endsection