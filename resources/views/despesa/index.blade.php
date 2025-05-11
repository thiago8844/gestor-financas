@extends('layouts.main')

@push('styles')

  <style>

  </style>

@endpush

@section('content')

<main class=" mx-auto vh-100 p-4" style="max-width: 1200px">

  <section>

    <div class="row">
      <div class="col-12">
        <h1>Despesas</h1>
      </div>
    </div>

    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-end">
          <a href="{{ route('despesas.create') }}" class="btn btn-success">Criar Despesa</a>
        </div>
      </div>
    </div>

    <div class="table-responsive ">
      <table class="table table-striped table-hover table-bordered align-middle">
        <thead class="table-dark">
          <tr>
            <th scope="col">Data</th>
            <th scope="col">Descrição</th>
            <th scope="col">Categoria</th>
            <th scope="col">Conta</th>
            <th scope="col" class="text-end">Valor</th>
            <th scope="col" class="text-center">Status</th>
            <th scope="col" class="text-center">Tipo</th>
            <th scope="col" class="text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          @forelse($despesas as $despesa)
            <tr>
              <td>{{ \Carbon\Carbon::parse($despesa->data)->format('d/m/Y') }}</td>
              <td>{{ $despesa->descricao }}</td>
              <td>
                @if($despesa->categoria)
                  <span class="badge rounded-pill" style="background-color: {{ $despesa->categoria->cor ?? '#6c757d' }}">
                    {{ $despesa->categoria->nome }}
                  </span>
                @else
                  <span class="text-muted">Sem categoria</span>
                @endif
              </td>
              <td>{{ $despesa->conta->nome }}</td>
              <td class="text-end fw-bold text-danger">
                R$ {{ number_format($despesa->valor, 2, ',', '.') }}
              </td>
              <td class="text-center">
                @if($despesa->paga)
                  <span class="badge bg-success">Paga</span>
                @else
                  <span class="badge bg-warning text-dark">Pendente</span>
                @endif
              </td>
              <td class="text-center">
                @if($despesa->fixa)
                  <span class="badge bg-primary">Fixa</span>
                @elseif($despesa->repetir)
                  <span class="badge bg-info text-dark">Recorrente</span>
                @else
                  <span class="badge bg-secondary">Normal</span>
                @endif
              </td>
              <td class="text-center">
                <div class="btn-group btn-group-sm" role="group">
                  <a href="{{ route('despesas.edit', $despesa->id) }}" class="btn btn-outline-primary">
                    <i class="bi bi-pencil"></i>
                  </a>
                  <button type="button" class="btn btn-outline-danger" 
                          data-bs-toggle="modal" 
                          data-bs-target="#deleteModal{{ $despesa->id }}">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
                
                <!-- Delete Modal -->
                <div class="modal fade" id="deleteModal{{ $despesa->id }}" tabindex="-1" aria-hidden="true">
                  <div class="modal-dialog">
                    <div class="modal-content">
                      <div class="modal-header">
                        <h5 class="modal-title">Confirmar Exclusão</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                      </div>
                      <div class="modal-body">
                        Tem certeza que deseja excluir a despesa <strong>{{ $despesa->descricao }}</strong>?
                      </div>
                      <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <form action="{{ route('despesas.destroy', $despesa->id) }}" method="POST" class="d-inline">
                          @csrf
                          @method('DELETE')
                          <button type="submit" class="btn btn-danger">Excluir</button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          @empty
            <tr>
              <td colspan="8" class="text-center py-4">
                <div class="d-flex flex-column align-items-center">
                  <i class="bi bi-inbox display-6 text-muted mb-3"></i>
                  <p class="text-muted mb-2">Nenhuma despesa encontrada</p>
                  <a href="{{ route('despesas.create') }}" class="btn btn-sm btn-success">
                    Criar sua primeira despesa
                  </a>
                </div>
              </td>
            </tr>
          @endforelse
        </tbody>
      </table>
    </div>


  </section>

</main>

@endsection