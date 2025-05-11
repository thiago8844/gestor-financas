<nav class="navbar navbar-expand-lg bg-primary navbar-dark my-3 rounded shadow">
  <div class="container-fluid">
    <a class="navbar-brand" href="{{ route('dashboard') }}">
      <i class="bi bi-wallet2"></i> 
      Gestor Finanças
    </a>
    
    <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
      <span class="navbar-toggler-icon"></span>
    </button>
    
    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav me-auto">
        <li class="nav-item">
          <a class="nav-link {{ request()->routeIs('dashboard') ? 'active' : '' }}" href="{{ route('dashboard') }}">
            <i class="bi bi-house"></i> Dashboard
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link {{ request()->routeIs('contas.*') ? 'active' : '' }}" href="{{ route('contas.index') }}">
            <i class="bi bi-cash-stack"></i> Contas
          </a>
        </li>
        <li class="nav-item">
          <a 
          class="nav-link {{ request()->routeIs('despesas.*') ? 'active' : '' }}" 
          href="{{route('despesas.index')}}">
            <i class="bi bi-arrow-left-right"></i> Despesas
          </a>
        </li>
        <li class="nav-item">
          <a 
          class="nav-link {{ request()->routeIs('receitas.*') ? 'active' : '' }}" 
          href="{{route('receitas.index')}}">
            <i class="bi bi-arrow-left-right"></i> Receitas
          </a>
        </li>
      </ul>
      
      <div class="navbar-nav">
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
            <i class="bi bi-person-circle"></i> {{ Auth::user()->name }}
          </a>
          <ul class="dropdown-menu dropdown-menu-end">
            <li>
              <a class="dropdown-item" href="#">
                <i class="bi bi-gear"></i> Usuario
              </a>
            </li>
            <li><hr class="dropdown-divider"></li>
            <li>
              <form action="{{ route('logout') }}" method="POST">
                @csrf
                <button class="dropdown-item text-danger">
                  <i class="bi bi-box-arrow-right"></i> Sair
                </button>
              </form>
            </li>
          </ul>
        </li>
      </div>
    </div>

  </div>
</nav>