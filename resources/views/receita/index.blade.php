@extends('layouts.main')

@push('styles')

  <style>

  </style>

@endpush

@section('content')

<main class=" mx-auto vh-100 p-4">

  <section>

    <div class="row">
      <div class="col-12">
        <h1>Receita</h1>
      </div>
    </div>

    <div class="row">
      <div class="col-12">
        <div class="d-flex justify-content-end">
          <a href="/receita/cadastrar" class="btn btn-success">Criar Receita</a>
        </div>
      </div>
    </div>

    <table></table>


  </section>

</main>

@endsection