<?php

namespace Tests\Unit;

use App\Enums\TipoOrcamento;
use App\Models\Orcamento;
use App\Support\Orcamentos\CalculadoraPeriodoOrcamento;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CalculadoraPeriodoOrcamentoTest extends TestCase
{
    private function orcamento(array $overrides = []): Orcamento
    {
        return new Orcamento(array_merge([
            'type' => TipoOrcamento::RECURRING,
            'frequency' => 'MONTHLY',
            'interval' => 1,
            'start_date' => '2026-01-10',
        ], $overrides));
    }

    #[Test]
    public function periodo_mensal_simples_e_o_mes_calendario_cheio(): void
    {
        $orcamento = $this->orcamento();

        $periodo = (new CalculadoraPeriodoOrcamento())->periodoContendo($orcamento, Carbon::parse('2026-08-23'));

        $this->assertEquals('2026-08-01', $periodo['inicio']->toDateString());
        $this->assertEquals('2026-08-31', $periodo['fim']->toDateString());
    }

    #[Test]
    public function periodo_semanal_e_a_semana_cheia_de_segunda_a_domingo(): void
    {
        $orcamento = $this->orcamento(['frequency' => 'WEEKLY']);

        // 2026-08-23 é uma segunda-feira
        $periodo = (new CalculadoraPeriodoOrcamento())->periodoContendo($orcamento, Carbon::parse('2026-08-23'));

        $this->assertEquals('2026-08-23', $periodo['inicio']->toDateString());
        $this->assertEquals('2026-08-29', $periodo['fim']->toDateString());
    }

    #[Test]
    public function periodo_anual_e_o_ano_cheio(): void
    {
        $orcamento = $this->orcamento(['frequency' => 'YEARLY']);

        $periodo = (new CalculadoraPeriodoOrcamento())->periodoContendo($orcamento, Carbon::parse('2026-08-23'));

        $this->assertEquals('2026-01-01', $periodo['inicio']->toDateString());
        $this->assertEquals('2026-12-31', $periodo['fim']->toDateString());
    }

    #[Test]
    public function periodo_a_cada_3_meses_forma_blocos_ancorados_no_mes_inicial(): void
    {
        $orcamento = $this->orcamento(['interval' => 3, 'start_date' => '2026-01-10']);
        $calculadora = new CalculadoraPeriodoOrcamento();

        $periodoAgosto = $calculadora->periodoContendo($orcamento, Carbon::parse('2026-08-23'));
        $this->assertEquals('2026-07-01', $periodoAgosto['inicio']->toDateString());
        $this->assertEquals('2026-09-30', $periodoAgosto['fim']->toDateString());

        $periodoJaneiro = $calculadora->periodoContendo($orcamento, Carbon::parse('2026-01-10'));
        $this->assertEquals('2026-01-01', $periodoJaneiro['inicio']->toDateString());
        $this->assertEquals('2026-03-31', $periodoJaneiro['fim']->toDateString());
    }

    #[Test]
    public function periodo_anterior_e_seguinte_navegam_um_bloco_por_vez(): void
    {
        $orcamento = $this->orcamento();
        $calculadora = new CalculadoraPeriodoOrcamento();

        $atual = $calculadora->periodoContendo($orcamento, Carbon::parse('2026-08-23'));
        $anterior = $calculadora->periodoAnterior($orcamento, $atual);
        $seguinte = $calculadora->periodoSeguinte($orcamento, $atual);

        $this->assertEquals('2026-07-01', $anterior['inicio']->toDateString());
        $this->assertEquals('2026-07-31', $anterior['fim']->toDateString());

        $this->assertEquals('2026-09-01', $seguinte['inicio']->toDateString());
        $this->assertEquals('2026-09-30', $seguinte['fim']->toDateString());
    }
}
