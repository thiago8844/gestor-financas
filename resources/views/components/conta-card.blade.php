

<div class="card mb-3">
    <div class="card-body">
        <h5 class="card-title">{{$conta->nome}}</h5>
        <p class="card-text">Saldo: R$<span>{{ formatCurrency($conta->saldo) }}</span></p>
    </div>
</div>
