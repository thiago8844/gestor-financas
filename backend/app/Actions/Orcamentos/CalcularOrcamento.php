<?php

namespace App\Actions\Orcamentos;

use App\Models\Orcamento;
use App\Models\Transacao;
use App\Support\Orcamentos\CalculadoraPeriodoOrcamento;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

class CalcularOrcamento
{
    private CalculadoraPeriodoOrcamento $calculadoraPeriodo;

    public function __construct(?CalculadoraPeriodoOrcamento $calculadoraPeriodo = null)
    {
        $this->calculadoraPeriodo = $calculadoraPeriodo ?? new CalculadoraPeriodoOrcamento();
    }

    public function executar(Orcamento $orcamento, ?CarbonInterface $referencia = null): array
    {
        $referencia = $referencia ? Carbon::parse($referencia) : Carbon::today();

        return $orcamento->isRecorrente()
            ? $this->calcularRecorrente($orcamento, $referencia)
            : $this->calcularPontual($orcamento);
    }

    private function calcularRecorrente(Orcamento $orcamento, Carbon $referencia): array
    {
        $periodo = $this->calculadoraPeriodo->periodoContendo($orcamento, $referencia);
        $limite = $orcamento->limiteEm($periodo['inicio']);

        $transacoes = $orcamento->transacoes()->with('categoria')->get();

        $pertenceAoPeriodo = fn (Carbon $data) => $data->between($periodo['inicio'], $periodo['fim']);

        [$gasto, $consideradas, $porCategoria] = $this->calcularGasto($orcamento, $transacoes, $pertenceAoPeriodo);

        $periodoAnterior = $this->calculadoraPeriodo->periodoAnterior($orcamento, $periodo);
        $periodoSeguinte = $this->calculadoraPeriodo->periodoSeguinte($orcamento, $periodo);

        return $this->montarResumo(
            $orcamento,
            $limite,
            $gasto,
            $consideradas,
            $porCategoria,
            $this->formatarPeriodo($periodo),
            $this->formatarPeriodo($periodoAnterior),
            $this->formatarPeriodo($periodoSeguinte)
        );
    }

    private function calcularPontual(Orcamento $orcamento): array
    {
        $periodos = $orcamento->periodos;
        $limite = is_null($orcamento->amount_limit) ? null : (float) $orcamento->amount_limit;

        $transacoes = $orcamento->transacoes()->with('categoria')->get();

        $pertenceAoPeriodo = function (Carbon $data) use ($periodos) {
            foreach ($periodos as $periodo) {
                if ($data->between($periodo->start_date, $periodo->end_date)) {
                    return true;
                }
            }

            return false;
        };

        [$gasto, $consideradas, $porCategoria] = $this->calcularGasto($orcamento, $transacoes, $pertenceAoPeriodo);

        $resumo = $this->montarResumo($orcamento, $limite, $gasto, $consideradas, $porCategoria, null, null, null);
        $resumo['periodos_pontuais'] = $periodos->map(fn ($periodo) => [
            'id' => $periodo->id,
            'inicio' => $periodo->start_date->toDateString(),
            'fim' => $periodo->end_date->toDateString(),
        ])->values();

        return $resumo;
    }

    /**
     * Soma o gasto do orçamento respeitando a regra de parceladas: se `ignore_pending_installments`
     * estiver ativo, cada grupo de parcelas conta uma única vez pelo valor total da compra (no período
     * da 1ª parcela); senão, cada parcela conta individualmente pelo período em que sua própria data cai.
     *
     * @return array{0: float, 1: Collection, 2: array<string, float>}
     */
    private function calcularGasto(Orcamento $orcamento, Collection $transacoes, callable $pertenceAoPeriodo): array
    {
        $gasto = 0.0;
        $consideradas = collect();
        $porCategoria = [];

        $avulsas = $transacoes->whereNull('installment_group');
        $grupos = $transacoes->whereNotNull('installment_group')->groupBy('installment_group');

        foreach ($avulsas as $transacao) {
            if ($pertenceAoPeriodo($this->dataReferencia($transacao))) {
                $gasto += (float) $transacao->amount;
                $consideradas->push($transacao);
                $this->acumularCategoria($porCategoria, $transacao->categoria?->name, (float) $transacao->amount);
            }
        }

        foreach ($grupos as $grupoId => $transacoesDoGrupo) {
            $primeiraParcela = $transacoesDoGrupo->sortBy('installment_number')->first();

            if ($orcamento->ignore_pending_installments) {
                if ($pertenceAoPeriodo($this->dataReferencia($primeiraParcela))) {
                    $totalGrupo = (float) Transacao::where('installment_group', $grupoId)->sum('amount');
                    $gasto += $totalGrupo;
                    $consideradas = $consideradas->concat($transacoesDoGrupo);
                    $this->acumularCategoria($porCategoria, $primeiraParcela->categoria?->name, $totalGrupo);
                }

                continue;
            }

            foreach ($transacoesDoGrupo as $transacao) {
                if ($pertenceAoPeriodo($this->dataReferencia($transacao))) {
                    $gasto += (float) $transacao->amount;
                    $consideradas->push($transacao);
                    $this->acumularCategoria($porCategoria, $transacao->categoria?->name, (float) $transacao->amount);
                }
            }
        }

        return [$gasto, $consideradas->values(), $porCategoria];
    }

    private function dataReferencia(Transacao $transacao): Carbon
    {
        return Carbon::parse($transacao->date ?? $transacao->due_date ?? $transacao->created_at);
    }

    private function acumularCategoria(array &$acumulado, ?string $categoria, float $valor): void
    {
        $chave = $categoria ?? 'Sem categoria';
        $acumulado[$chave] = ($acumulado[$chave] ?? 0) + $valor;
    }

    /**
     * @param array{inicio: Carbon, fim: Carbon} $periodo
     */
    private function formatarPeriodo(array $periodo): array
    {
        return [
            'inicio' => $periodo['inicio']->toDateString(),
            'fim' => $periodo['fim']->toDateString(),
        ];
    }

    private function montarResumo(
        Orcamento $orcamento,
        ?float $limite,
        float $gasto,
        Collection $transacoesConsideradas,
        array $gastoPorCategoriaBruto,
        ?array $periodo,
        ?array $periodoAnterior,
        ?array $periodoSeguinte
    ): array {
        $disponivel = is_null($limite) ? null : round($limite - $gasto, 2);
        $percentual = $limite && $limite > 0 ? round(($gasto / $limite) * 100, 1) : null;
        $alertaAtingido = $orcamento->alert_percentage && !is_null($percentual) && $percentual >= $orcamento->alert_percentage;

        $gastoPorCategoria = collect($gastoPorCategoriaBruto)
            ->map(fn ($total, $categoria) => ['categoria' => $categoria, 'total' => round($total, 2)])
            ->values()
            ->sortByDesc('total')
            ->values();

        return [
            'periodo' => $periodo,
            'periodo_anterior' => $periodoAnterior,
            'periodo_seguinte' => $periodoSeguinte,
            'periodos_pontuais' => null,
            'limite' => $limite,
            'gasto' => round($gasto, 2),
            'disponivel' => $disponivel,
            'percentual_utilizado' => $percentual,
            'alerta_atingido' => $alertaAtingido,
            'gasto_por_categoria' => $gastoPorCategoria,
            'transacoes' => $transacoesConsideradas,
        ];
    }
}
