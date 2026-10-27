<?php

namespace App\Support\Emprestimos;

use App\Enums\ModalidadeEmprestimo;
use Carbon\Carbon;
use InvalidArgumentException;

/**
 * Gera as parcelas de um empréstimo. Serviço puro: não toca no banco.
 *
 * Valores são arredondados a centavos e a última parcela absorve a diferença, para que a soma
 * do principal sempre feche com o valor emprestado.
 *
 * Nas modalidades JUROS_PERIODICOS, PRICE e SAC os juros incidem sobre o saldo devedor a cada
 * período; o tipo (simples/composto) define como a taxa é convertida entre períodos
 * (ver Juros::taxaPorPeriodo). Só no PAGAMENTO_UNICO a capitalização muda o valor final.
 *
 * @phpstan-type Parcela array{
 *     numero: int, vencimento: Carbon, valor_principal: float, valor_juros: float, valor_previsto: float
 * }
 */
class GeradorCronograma
{
    /** Quantas parcelas gerar de uma vez num contrato com prazo em aberto. */
    public const PARCELAS_PRAZO_ABERTO = 24;

    public const MAXIMO_PARCELAS = 600;

    /**
     * @return array<int, array{numero: int, vencimento: Carbon, valor_principal: float, valor_juros: float, valor_previsto: float}>
     */
    public function gerar(ContratoEmprestimo $contrato, ?int $quantidadePrazoAberto = null): array
    {
        if ($contrato->principal <= 0) {
            throw new InvalidArgumentException('O valor do empréstimo deve ser maior que zero.');
        }

        return match ($contrato->modalidade) {
            ModalidadeEmprestimo::LIVRE => $this->livre($contrato),
            ModalidadeEmprestimo::PAGAMENTO_UNICO => $this->pagamentoUnico($contrato),
            ModalidadeEmprestimo::JUROS_PERIODICOS => $this->jurosPeriodicos($contrato, $quantidadePrazoAberto),
            ModalidadeEmprestimo::PRICE, ModalidadeEmprestimo::SAC => $this->amortizado($contrato),
        };
    }

    private function regra(ContratoEmprestimo $contrato): RegraVencimento
    {
        return new RegraVencimento(
            $contrato->frequencia,
            $contrato->primeiroVencimento,
            $contrato->diaVencimento,
            $contrato->ajusteDia,
        );
    }

    private function taxaPeriodo(ContratoEmprestimo $contrato): float
    {
        return Juros::taxaPorPeriodo($contrato->taxa, $contrato->periodoTaxa, $contrato->tipoJuros, $contrato->frequencia);
    }

    private function parcela(int $numero, Carbon $vencimento, float $principal, float $juros): array
    {
        return [
            'numero' => $numero,
            'vencimento' => $vencimento,
            'valor_principal' => $principal,
            'valor_juros' => $juros,
            'valor_previsto' => Juros::arredondar($principal + $juros),
        ];
    }

    private function jurosPeriodicos(ContratoEmprestimo $contrato, ?int $quantidadePrazoAberto): array
    {
        $aberto = $contrato->prazoAberto();
        $total = $aberto
            ? ($quantidadePrazoAberto ?? self::PARCELAS_PRAZO_ABERTO)
            : $this->totalParcelas($contrato);

        $regra = $this->regra($contrato);
        $juros = Juros::arredondar($contrato->principal * $this->taxaPeriodo($contrato));
        $parcelas = [];

        for ($numero = 1; $numero <= $total; $numero++) {
            // Em prazo aberto o principal só volta quando o contrato for encerrado.
            $principal = (!$aberto && $numero === $total) ? Juros::arredondar($contrato->principal) : 0.0;
            $parcelas[] = $this->parcela($numero, $regra->data($numero - 1), $principal, $juros);
        }

        return $parcelas;
    }

    private function amortizado(ContratoEmprestimo $contrato): array
    {
        $total = $this->totalParcelas($contrato);
        $carencia = max(0, $contrato->carencia);

        if ($carencia >= $total) {
            throw new InvalidArgumentException('A carência deve ser menor que o número de parcelas.');
        }

        $amortizantes = $total - $carencia;
        $taxa = $this->taxaPeriodo($contrato);
        $regra = $this->regra($contrato);

        if ($contrato->modalidade === ModalidadeEmprestimo::PRICE) {
            $valorParcela = $taxa > 0
                ? $contrato->principal * $taxa / (1 - (1 + $taxa) ** -$amortizantes)
                : $contrato->principal / $amortizantes;
        } else {
            $amortizacao = Juros::arredondar($contrato->principal / $amortizantes);
        }

        $saldo = Juros::arredondar($contrato->principal);
        $parcelas = [];

        for ($numero = 1; $numero <= $total; $numero++) {
            $juros = Juros::arredondar($saldo * $taxa);

            if ($numero <= $carencia) {
                $principal = 0.0;
            } elseif ($numero === $total) {
                $principal = $saldo;
            } elseif ($contrato->modalidade === ModalidadeEmprestimo::PRICE) {
                $principal = min($saldo, Juros::arredondar(Juros::arredondar($valorParcela) - $juros));
            } else {
                $principal = min($saldo, $amortizacao);
            }

            $parcelas[] = $this->parcela($numero, $regra->data($numero - 1), $principal, $juros);
            $saldo = Juros::arredondar($saldo - $principal);
        }

        return $parcelas;
    }

    private function pagamentoUnico(ContratoEmprestimo $contrato): array
    {
        $vencimento = $this->regra($contrato)->data(0);
        $dias = max(0, $contrato->dataContratacao->diffInDays($vencimento, false));
        $meses = $dias / Juros::DIAS_NO_MES;

        $taxaMensal = Juros::taxaMensal($contrato->taxa, $contrato->periodoTaxa, $contrato->tipoJuros);
        $juros = Juros::arredondar(Juros::jurosAcumulados($contrato->principal, $taxaMensal, $meses, $contrato->tipoJuros));

        return [$this->parcela(1, $vencimento, Juros::arredondar($contrato->principal), $juros)];
    }

    private function livre(ContratoEmprestimo $contrato): array
    {
        if ($contrato->parcelasLivres === []) {
            throw new InvalidArgumentException('Informe ao menos uma parcela.');
        }

        $ordenadas = collect($contrato->parcelasLivres)
            ->map(fn (array $p) => [
                'vencimento' => Carbon::parse($p['due_date'])->startOfDay(),
                'principal' => Juros::arredondar((float) $p['principal_amount']),
                'juros' => Juros::arredondar((float) ($p['interest_amount'] ?? 0)),
            ])
            ->sortBy('vencimento')
            ->values();

        return $ordenadas
            ->map(fn (array $p, int $i) => $this->parcela($i + 1, $p['vencimento'], $p['principal'], $p['juros']))
            ->all();
    }

    private function totalParcelas(ContratoEmprestimo $contrato): int
    {
        $total = $contrato->parcelas;

        if ($total === null || $total < 1) {
            throw new InvalidArgumentException('Informe o número de parcelas.');
        }

        if ($total > self::MAXIMO_PARCELAS) {
            throw new InvalidArgumentException('Número de parcelas acima do máximo permitido.');
        }

        return $total;
    }
}
