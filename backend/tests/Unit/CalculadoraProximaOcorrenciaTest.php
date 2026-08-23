<?php

namespace Tests\Unit;

use App\Enums\FrequenciaRecorrencia;
use App\Models\RecorrenciaTransacao;
use App\Support\Recorrencia\CalculadoraProximaOcorrencia;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CalculadoraProximaOcorrenciaTest extends TestCase
{
    private function recorrencia(array $atributos): RecorrenciaTransacao
    {
        return new RecorrenciaTransacao($atributos);
    }

    #[Test]
    public function diaria_a_cada_15_dias(): void
    {
        $calculadora = new CalculadoraProximaOcorrencia();

        $recorrencia = $this->recorrencia([
            'frequency' => FrequenciaRecorrencia::DAILY,
            'interval' => 15,
            'start_date' => '2026-08-10',
        ]);

        $primeira = $calculadora->primeiraOcorrencia($recorrencia);
        $this->assertTrue($primeira->isSameDay(Carbon::parse('2026-08-10')));

        $segunda = $calculadora->proximaAPartirDe($recorrencia, $primeira);
        $this->assertTrue($segunda->isSameDay(Carbon::parse('2026-08-25')));

        $terceira = $calculadora->proximaAPartirDe($recorrencia, $segunda);
        $this->assertTrue($terceira->isSameDay(Carbon::parse('2026-09-09')));
    }

    #[Test]
    public function semanal_toda_segunda_e_sexta(): void
    {
        $calculadora = new CalculadoraProximaOcorrencia();

        // 2026-08-10 é uma segunda-feira
        $recorrencia = $this->recorrencia([
            'frequency' => FrequenciaRecorrencia::WEEKLY,
            'days_of_week' => [1, 5], // segunda, sexta
            'start_date' => '2026-08-10',
        ]);

        $primeira = $calculadora->primeiraOcorrencia($recorrencia);
        $this->assertTrue($primeira->isSameDay(Carbon::parse('2026-08-10'))); // segunda

        $segunda = $calculadora->proximaAPartirDe($recorrencia, $primeira);
        $this->assertTrue($segunda->isSameDay(Carbon::parse('2026-08-14'))); // sexta da mesma semana

        $terceira = $calculadora->proximaAPartirDe($recorrencia, $segunda);
        $this->assertTrue($terceira->isSameDay(Carbon::parse('2026-08-17'))); // segunda seguinte
    }

    #[Test]
    public function mensal_a_cada_3_meses(): void
    {
        $calculadora = new CalculadoraProximaOcorrencia();

        $recorrencia = $this->recorrencia([
            'frequency' => FrequenciaRecorrencia::MONTHLY,
            'interval' => 3,
            'day_of_month' => 10,
            'start_date' => '2026-01-10',
        ]);

        $primeira = $calculadora->primeiraOcorrencia($recorrencia);
        $this->assertTrue($primeira->isSameDay(Carbon::parse('2026-01-10')));

        $segunda = $calculadora->proximaAPartirDe($recorrencia, $primeira);
        $this->assertTrue($segunda->isSameDay(Carbon::parse('2026-04-10')));

        $terceira = $calculadora->proximaAPartirDe($recorrencia, $segunda);
        $this->assertTrue($terceira->isSameDay(Carbon::parse('2026-07-10')));

        $quarta = $calculadora->proximaAPartirDe($recorrencia, $terceira);
        $this->assertTrue($quarta->isSameDay(Carbon::parse('2026-10-10')));
    }

    #[Test]
    public function mensal_faz_clamp_no_dia_31_em_mes_curto(): void
    {
        $calculadora = new CalculadoraProximaOcorrencia();

        $recorrencia = $this->recorrencia([
            'frequency' => FrequenciaRecorrencia::MONTHLY,
            'interval' => 1,
            'day_of_month' => 31,
            'start_date' => '2026-01-31',
        ]);

        $primeira = $calculadora->primeiraOcorrencia($recorrencia);
        $this->assertTrue($primeira->isSameDay(Carbon::parse('2026-01-31')));

        // Fevereiro/2026 tem 28 dias
        $segunda = $calculadora->proximaAPartirDe($recorrencia, $primeira);
        $this->assertTrue($segunda->isSameDay(Carbon::parse('2026-02-28')));

        $terceira = $calculadora->proximaAPartirDe($recorrencia, $segunda);
        $this->assertTrue($terceira->isSameDay(Carbon::parse('2026-03-31')));
    }

    #[Test]
    public function anual_todo_dia_15_de_janeiro(): void
    {
        $calculadora = new CalculadoraProximaOcorrencia();

        $recorrencia = $this->recorrencia([
            'frequency' => FrequenciaRecorrencia::YEARLY,
            'interval' => 1,
            'day_of_month' => 15,
            'month_of_year' => 1,
            'start_date' => '2026-01-15',
        ]);

        $primeira = $calculadora->primeiraOcorrencia($recorrencia);
        $this->assertTrue($primeira->isSameDay(Carbon::parse('2026-01-15')));

        $segunda = $calculadora->proximaAPartirDe($recorrencia, $primeira);
        $this->assertTrue($segunda->isSameDay(Carbon::parse('2027-01-15')));
    }

    #[Test]
    public function primeira_ocorrencia_pula_pra_frente_quando_start_date_nao_bate_no_padrao(): void
    {
        $calculadora = new CalculadoraProximaOcorrencia();

        // 2026-08-11 é uma terça-feira, recorrência é toda sexta
        $recorrencia = $this->recorrencia([
            'frequency' => FrequenciaRecorrencia::WEEKLY,
            'days_of_week' => [5],
            'start_date' => '2026-08-11',
        ]);

        $primeira = $calculadora->primeiraOcorrencia($recorrencia);
        $this->assertTrue($primeira->isSameDay(Carbon::parse('2026-08-14')));
    }
}
