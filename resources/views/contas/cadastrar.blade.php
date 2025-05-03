@extends('layouts.main')

@push('styles')

@endpush

@section('content')

<main class="mx-auto vh-100" style="max-width: 500px;">
  
  <h1 class="text-center mt-5">Cadastrar Conta</h1>
  
  <x-errors/>

  <form x-data action="{{route('contas.cadastrar')}}" method="POST">
    @csrf
    
    <div class="form-group mb-3">
      <label for="name">Nome da Conta:</label>
      <input id="name" name="nome" type="text" class="form-control form-control-sm" value="{{old('nome')}}">
    </div>

    <div class="form-group mb-3">
      <label for="saldo">Saldo Inicial:</label>
      <input 
      x-init="createMoneyMask($el)"
      @input="$refs.saldo.value = currencyToNumber($el.value)" 
      id="saldo" type="text" class="form-control form-control-sm" value="{{old('saldo')}}">
      {{-- Posso fazer a criação desse input hidden automático, mas por enquanto só pra brincar esse serve --}}
      <input type="hidden" name="saldo" x-ref="saldo" value="{{old('saldo')}}">
    </div>


    <button type="submit" class="btn btn-success">Cadastrar</button>

  </form>

</main>

@endsection

@push('scripts')

  <script type="module">

      console.log(createMoneyMask)

  </script>

@endpush