@extends('layouts.main')

@push('styles')

  <style>

  </style>

@endpush

@section('content')

<main class=" mx-auto vh-100">

  <section>

    <div class="row">
      <div class="col-12">
        <h1>Contas</h1>
      </div>
    </div>

    <div class="d-flex justify-content-end mb-5">
      <a href="/contas/cadastrar" class="btn btn-success">Criar Conta</a>
    </div>

    <div class="row">
      <div class="col-12">
        <ul style="list-style: none; padding: 0;">
          @foreach($contas as $conta)
            <li class="mb-3">
              <x-conta-card :conta="$conta"/>
            </li>
          @endforeach
        </ul>
      </div>
    </div>


  </section>

</main>

@endsection