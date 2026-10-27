<?php

namespace App\Support\Emprestimos;

use App\Enums\ModalidadeEmprestimo;
use App\Enums\StatusEmprestimo;
use App\Enums\StatusParcelaEmprestimo;
use App\Models\Emprestimo;
use App\Models\EmprestimoAjuste;
use App\Models\EmprestimoParcela;
use Carbon\Carbon;
use DomainException;
use Illuminate\Support\Collection;

/**
 * Recalcula as parcelas futuras de um contrato quando o principal muda no meio do caminho:
 * amortização extra (o saldo diminui) ou aumento (emprestar mais no mesmo contrato).
 *
 * Só lê o banco; quem grava é AjustarEmprestimo. Por isso também serve para simular.
 *
 * Regras:
 *  - Só as parcelas PREVISTAS que vencem depois da data do ajuste são refeitas. O que já foi pago,
 *    está parcial ou venceu continua como está.
 *  - Os juros do período corrente são proporcionais aos dias corridos desde o último vencimento
 *    (fração do período decorrida). Na amortização o devedor paga essa fração
 *    sobre o valor abatido; no aumento ela é descontada da primeira parcela nova.
 *  - MANTER_PRAZO refaz o valor das parcelas com o mesmo número de parcelas. MANTER_PARCELA mantém
 *    o valor (Price) ou a amortização (SAC) e muda o número de parcelas; a última sai menor.
 */
class CalculadoraAjuste
{
    public const MANTER_PRAZO = 'MANTER_PRAZO';
    public const MANTER_PARCELA = 'MANTER_PARCELA';

    private const MODALIDADES_SUPORTADAS = [
        ModalidadeEmprestimo::JUROS_PERIODICOS,
        ModalidadeEmprestimo::PRICE,
        ModalidadeEmprestimo::SAC,
    ];

    /**
     * @return array{
     *     futuras: Collection<int, EmprestimoParcela>,
     *     novas: array<int, array{numero: int, vencimento: Carbon, valor_principal: float, valor_juros: float, valor_previsto: float}>,
     *     juros_proporcionais: float,
     *     valor_a_lancar: float,
     *     saldo_antes: float,
     *     saldo_depois: float,
     * }
     * @throws DomainException
     */
    public function calcular(
        Emprestimo $emprestimo,
        string $tipo,
        float $valor,
        Carbon $data,
        string $modo = self::MANTER_PRAZO,
        ?int $parcelas = null,
    ): array {
        $valor = round($valor, 2);
        $data = $data->copy()->startOfDay();
        $amortizacao = $tipo === EmprestimoAjuste::AMORTIZACAO;

        $this->validarContrato($emprestimo, $amortizacao, $valor);

        $todas = $emprestimo->parcelas()->reorder()->orderBy('number')->get();

        if ($todas->contains(fn (EmprestimoParcela $p) => $p->status === StatusParcelaEmprestimo::PARCIAL && $p->due_date->gt($data))) {
            throw new DomainException('Há uma parcela paga em parte. Quite essa parcela antes de ajustar o empréstimo.');
        }

        $futuras = $todas
            ->filter(fn (EmprestimoParcela $p) => $p->status === StatusParcelaEmprestimo::PREVISTA && $p->due_date->gt($data))
            ->values();

        $saldoAntes = $emprestimo->prazoAberto()
            ? $emprestimo->saldoPrincipal()
            : round($futuras->sum(fn (EmprestimoParcela $p) => (float) $p->principal_amount), 2);

        if ($amortizacao && $valor > $saldoAntes + 0.009) {
            throw new DomainException('O valor é maior que o saldo do empréstimo (R$ ' . number_format($saldoAntes, 2, ',', '.') . ').');
        }

        $saldoDepois = round($amortizacao ? $saldoAntes - $valor : $saldoAntes + $valor, 2);

        $taxa = Juros::taxaPorPeriodo((float) $emprestimo->rate, $emprestimo->rate_period, $emprestimo->interest_type, $emprestimo->frequency);
        $ancora = $this->primeiroVencimentoNovo($emprestimo, $todas, $futuras, $data);
        $fracao = $this->fracaoDoPeriodo($emprestimo, $todas, $data, $ancora);
        $jurosProporcionais = Juros::arredondar($valor * $taxa * $fracao);

        if ($saldoDepois <= 0.009) {
            $novas = [];
        } elseif ($this->mantemValorDaParcela($emprestimo, $futuras, $modo, $parcelas)) {
            $novas = $this->gerarComValorFixo($emprestimo, $saldoDepois, $taxa, $ancora, $futuras->first());
        } else {
            $quantidade = $this->quantidadeDeParcelas($futuras, $saldoDepois, $parcelas, $amortizacao);
            $novas = $this->gerarNovas($emprestimo, $saldoDepois, $data, $ancora, $quantidade);
        }

        $primeiroNumero = (int) $todas->reject(fn (EmprestimoParcela $p) => $futuras->contains('id', $p->id))->max('number') + 1;
        $novas = array_map(fn (array $p) => [...$p, 'numero' => $p['numero'] + $primeiroNumero - 1], $novas);

        // No aumento, o dinheiro novo só rende a partir da data do ajuste: tira da primeira parcela a fração que já passou.
        if (!$amortizacao && $novas !== [] && $jurosProporcionais > 0) {
            $juros = max(0.0, Juros::arredondar($novas[0]['valor_juros'] - $jurosProporcionais));
            $novas[0] = [...$novas[0], 'valor_juros' => $juros, 'valor_previsto' => Juros::arredondar($novas[0]['valor_principal'] + $juros)];
        }

        return [
            'futuras' => $futuras,
            'novas' => $novas,
            'juros_proporcionais' => $amortizacao ? $jurosProporcionais : 0.0,
            'valor_a_lancar' => Juros::arredondar($amortizacao ? $valor + $jurosProporcionais : $valor),
            'saldo_antes' => $saldoAntes,
            'saldo_depois' => $saldoDepois,
        ];
    }

    /** Números para a tela de simulação (não grava nada). */
    public function resumo(Emprestimo $emprestimo, array $plano): array
    {
        /** @var Collection<int, EmprestimoParcela> $futuras */
        $futuras = $plano['futuras'];
        $novas = collect($plano['novas']);

        $jurosAntes = round($futuras->sum(fn (EmprestimoParcela $p) => (float) $p->interest_amount), 2);
        $jurosDepois = round($novas->sum('valor_juros'), 2);

        return [
            'balance_before' => $plano['saldo_antes'],
            'balance_after' => $plano['saldo_depois'],
            'accrued_interest' => $plano['juros_proporcionais'],
            'amount_to_post' => $plano['valor_a_lancar'],
            'installments_before' => $futuras->count(),
            'installments_after' => $novas->count(),
            'next_amount_before' => $futuras->isNotEmpty() ? (float) $futuras->first()->expected_amount : null,
            'next_amount_after' => $novas->isNotEmpty() ? $novas->first()['valor_previsto'] : null,
            'end_date_before' => $futuras->isNotEmpty() ? $futuras->last()->due_date->toDateString() : null,
            'end_date_after' => $novas->isNotEmpty() ? $novas->last()['vencimento']->toDateString() : null,
            'interest_before' => $jurosAntes,
            'interest_after' => $jurosDepois,
            'interest_difference' => round($jurosAntes - $jurosDepois, 2),
            'installments' => $novas->map(fn (array $p) => [
                'number' => $p['numero'],
                'due_date' => $p['vencimento']->toDateString(),
                'principal_amount' => $p['valor_principal'],
                'interest_amount' => $p['valor_juros'],
                'expected_amount' => $p['valor_previsto'],
            ])->values()->all(),
        ];
    }

    private function validarContrato(Emprestimo $emprestimo, bool $amortizacao, float $valor): void
    {
        if ($valor <= 0) {
            throw new DomainException('O valor deve ser maior que zero.');
        }

        if (!in_array($emprestimo->modality, self::MODALIDADES_SUPORTADAS, true)) {
            throw new DomainException('Amortização e aumento não estão disponíveis para esta modalidade de empréstimo.');
        }

        if ($emprestimo->status === StatusEmprestimo::CANCELADO) {
            throw new DomainException('Este empréstimo está cancelado.');
        }

        // Quitado só aceita aumento (reabre o contrato).
        if ($emprestimo->status === StatusEmprestimo::QUITADO && $amortizacao) {
            throw new DomainException('Este empréstimo já está quitado.');
        }
    }

    /**
     * Data da primeira parcela refeita: a primeira que já existia (mantém o calendário) ou, se não sobrou
     * nenhuma, o próximo vencimento da regra depois da data do ajuste.
     */
    private function primeiroVencimentoNovo(Emprestimo $emprestimo, Collection $todas, Collection $futuras, Carbon $data): Carbon
    {
        if ($futuras->isNotEmpty()) {
            return $futuras->first()->due_date->copy()->startOfDay();
        }

        $ultima = $todas->reject(fn (EmprestimoParcela $p) => $p->status === StatusParcelaEmprestimo::CANCELADA)->max('due_date')
            ?? $emprestimo->first_due_date;

        $regra = new RegraVencimento($emprestimo->frequency, Carbon::parse($ultima), $emprestimo->due_day, $emprestimo->due_day_adjustment);

        for ($i = 1; $i < 1200; $i++) {
            $candidata = $regra->data($i);
            if ($candidata->gt($data)) {
                return $candidata;
            }
        }

        throw new DomainException('Não foi possível calcular o próximo vencimento.');
    }

    /** Quanto do período corrente já passou na data do ajuste (0 a 1). */
    private function fracaoDoPeriodo(Emprestimo $emprestimo, Collection $todas, Carbon $data, Carbon $proximo): float
    {
        $anterior = $todas
            ->reject(fn (EmprestimoParcela $p) => $p->status === StatusParcelaEmprestimo::CANCELADA || $p->due_date->gt($data))
            ->max('due_date');

        $inicio = Carbon::parse($anterior ?? $emprestimo->contract_date)->startOfDay();
        $duracao = max(1.0, (float) $inicio->diffInDays($proximo, false));
        $decorrido = max(0.0, (float) $inicio->diffInDays($data, false));

        return min(1.0, $decorrido / $duracao);
    }

    private function quantidadeDeParcelas(Collection $futuras, float $novoSaldo, ?int $parcelas, bool $amortizacao): int
    {
        if ($parcelas !== null) {
            return max(1, min(GeradorCronograma::MAXIMO_PARCELAS, $parcelas));
        }

        if ($futuras->isEmpty()) {
            if ($amortizacao) {
                return 0;
            }
            throw new DomainException('Informe em quantas parcelas o novo valor será pago.');
        }

        return $futuras->count();
    }

    /** "Manter parcela" só existe em Price e SAC, sem número de parcelas informado e com parcelas futuras de referência. */
    private function mantemValorDaParcela(Emprestimo $emprestimo, Collection $futuras, string $modo, ?int $parcelas): bool
    {
        return $modo === self::MANTER_PARCELA
            && $parcelas === null
            && $futuras->isNotEmpty()
            && in_array($emprestimo->modality, [ModalidadeEmprestimo::PRICE, ModalidadeEmprestimo::SAC], true);
    }

    /**
     * Mantém o valor da parcela (Price) ou da amortização (SAC) e deixa o prazo se ajustar: as parcelas
     * seguem até o saldo zerar, e a última sai menor.
     */
    private function gerarComValorFixo(Emprestimo $emprestimo, float $saldo, float $taxa, Carbon $ancora, EmprestimoParcela $referencia): array
    {
        $price = $emprestimo->modality === ModalidadeEmprestimo::PRICE;
        $fixo = (float) ($price ? $referencia->expected_amount : $referencia->principal_amount);

        if ($price && $taxa > 0 && Juros::arredondar($saldo * $taxa) >= $fixo - 0.005) {
            throw new DomainException('A parcela atual não cobre nem os juros do novo saldo. Escolha manter o prazo.');
        }

        if ($fixo <= 0) {
            throw new DomainException('Não foi possível manter o valor da parcela.');
        }

        $regra = new RegraVencimento($emprestimo->frequency, $ancora, $emprestimo->due_day, $emprestimo->due_day_adjustment);
        $parcelas = [];
        $restante = Juros::arredondar($saldo);

        for ($numero = 1; $restante > 0.009; $numero++) {
            if ($numero > GeradorCronograma::MAXIMO_PARCELAS) {
                throw new DomainException('O prazo ficaria acima do máximo permitido. Escolha manter o prazo.');
            }

            $juros = Juros::arredondar($restante * $taxa);
            $principal = $price ? $fixo - $juros : $fixo;
            $principal = Juros::arredondar(min($restante, $principal));

            $parcelas[] = [
                'numero' => $numero,
                'vencimento' => $regra->data($numero - 1),
                'valor_principal' => $principal,
                'valor_juros' => $juros,
                'valor_previsto' => Juros::arredondar($principal + $juros),
            ];

            $restante = Juros::arredondar($restante - $principal);
        }

        return $parcelas;
    }

    private function gerarNovas(Emprestimo $emprestimo, float $saldo, Carbon $data, Carbon $ancora, int $quantidade): array
    {
        $aberto = $emprestimo->prazoAberto();

        $contrato = new ContratoEmprestimo(
            principal: $saldo,
            taxa: (float) $emprestimo->rate,
            periodoTaxa: $emprestimo->rate_period,
            tipoJuros: $emprestimo->interest_type,
            modalidade: $emprestimo->modality,
            frequencia: $emprestimo->frequency,
            dataContratacao: $data,
            primeiroVencimento: $ancora,
            diaVencimento: $emprestimo->due_day,
            ajusteDia: $emprestimo->due_day_adjustment,
            parcelas: $aberto ? null : $quantidade,
        );

        return (new GeradorCronograma())->gerar($contrato, $aberto ? max(1, $quantidade) : null);
    }
}
