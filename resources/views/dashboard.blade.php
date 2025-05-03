@extends('layouts.main')

@push('styles')

  <style>

  </style>

@endpush

@section('content')

<main class=" mx-auto vh-100">

  <h1 class="text-center mt-5 mb-4">Bem-Vindo {{Auth::user()->name}}</h1>

  <header class="row">
    <div class="col-12">
      <div class="d-flex justify-content-end">
        <form action="/logout" method="POST">
          @csrf
          <button class="btn btn-secondary">Sair</button>
        </form>
      </div>
    </div>
  </header>

  {{-- ABAS --}}
  <div class="row mt-4">
    <div class="col-3">
      <nav class="nav flex-column nav-pills" id="v-pills-tab" role="tablist" aria-orientation="vertical">
        <button class="nav-link active" id="v-pills-home-tab" data-bs-toggle="pill" data-bs-target="#v-pills-home" type="button" role="tab" aria-controls="v-pills-home" aria-selected="true">Contas</button>
        <button class="nav-link" id="v-pills-profile-tab" data-bs-toggle="pill" data-bs-target="#v-pills-profile" type="button" role="tab" aria-controls="v-pills-profile" aria-selected="false">Profile</button>
        <button class="nav-link" id="v-pills-settings-tab" data-bs-toggle="pill" data-bs-target="#v-pills-settings" type="button" role="tab" aria-controls="v-pills-settings" aria-selected="false">Settings</button>
      </nav>
    </div>
    <div class="col-9">
      <div class="tab-content" id="v-pills-tabContent">
        <div class="tab-pane fade show active" id="v-pills-home" role="tabpanel" aria-labelledby="v-pills-home-tab">
          @include('partials.contas')
        </div>
        <div class="tab-pane fade" id="v-pills-profile" role="tabpanel" aria-labelledby="v-pills-profile-tab">
          <h3>Profile Content</h3>
          <p>Here is your profile information.</p>
        </div>
        <div class="tab-pane fade" id="v-pills-settings" role="tabpanel" aria-labelledby="v-pills-settings-tab">
          <h3>Settings Content</h3>
          <p>Adjust your settings here.</p>
        </div>
      </div>
    </div>
  </div>

</main>

@endsection