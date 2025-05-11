@extends('layouts.main')

@push('styles')

  <style>

  </style>

@endpush

@section('content')

<main class=" mx-auto vh-100">

  <h1 class="text-center mt-5 mb-4">Bem-Vindo {{Auth::user()->name}}</h1>




</main>

@endsection