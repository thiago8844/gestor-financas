@extends('layouts.centered')

@push('styles')

  <style>
    .login {
      min-width: 500px;
    }
  </style>

@endpush

@section('content')

<main class="login mx-auto bg-white p-5 rounded shadow" style="height:  fit-content;">

  <h1 class="text-center mb-4">Login</h1>
  
  <x-errors/>

  <form action="/login" method="POST" >
    @csrf
    <div class="form-group mb-3">
      <label for="credencial">Nome de Usuario ou E-mail:</label>
      <input id="credencial" name="credencial" value="{{old('credencial')}}" type="text" class="form-control form-control-sm">
    </div>

    <div class="form-group">
      <label for="password">Senha:</label>
      <input name="password" id="password" value="{{old('password')}}" type="password" class="form-control form-control-sm">
    </div>

    <button type="submit" class="btn btn-primary mt-3">Entrar</button>
    <div>
      <a href="/cadastro" class="small">Não tem conta cadastre-se</a>
    </div>
    
  </form>

</main>

@endsection