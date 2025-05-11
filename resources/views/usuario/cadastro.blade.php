@extends('layouts.centered')

@push('styles')

  <style>
    .login {
      min-width: 700px;
    }
  </style>

@endpush

@section('content')

<main class="login mx-auto bg-white p-5 rounded shadow">
  
  <h1 class="text-center ">Cadastrar</h1>
  
  @if($errors->any()) 
    <div class="alert alert-danger">
      <ul>
        @foreach($errors->all() as $error) 
          <li>{{ $error }}</li>
        @endforeach
      </ul>
    </div>
  @endif

  <form action="/cadastro" method="POST">
    @csrf
    
    <div class="form-group mb-3">
      <label for="name">Nome Usuario:</label>
      <input id="name" name="nome" type="text" class="form-control form-control-sm" value="{{old('name')}}">
    </div>

    <div class="form-group mb-3">
      <label for="name">E-mail:</label>
      <input id="name" name="email" type="text" class="form-control form-control-sm" value="{{old('email')}}">
    </div>

    <div class="form-group mb-3">
      <label for="password">Senha:</label>
      <input id="password" name="password" type="password" class="form-control form-control-sm">
    </div>
    <div class="form-group mb-3">
      <label for="password">Repetir Senha:</label>
      <input id="password" name="password_confirmation" type="password" class="form-control form-control-sm" >
    </div>

    <button type="submit" class="btn btn-primary w-100">Entrar</button>
    <div>
      <a href="/login" class="small">Já tem conta ? Logue</a>
    </div>
  </form>

</main>

@endsection