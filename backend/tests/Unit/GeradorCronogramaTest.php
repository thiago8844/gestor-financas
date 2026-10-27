<?php

namespace Tests\Unit;

use App\Support\Emprestimos\ContratoEmprestimo;
use App\Support\Emprestimos\GeradorCronograma;
use App\Support\Emprestimos\Juros;
use App\Support\Emprestimos\RegraVencimento;
use App\Enums\FrequenciaEmprestimo;
use App\Enums\PeriodoTaxa;
use App\Enums\TipoJuros;
use Carbon\Carbon;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class GeradorCronogramaTest extends TestCase
{
    private function gerar(array $dados, ?int $aberto = null): array
    {
        return (new GeradorCronograma())->gerar(ContratoEmprestimo::dosDados([
            'principal' => 10000,
            'rate' => 2,
            'rate_period' => 'MES',
            'interest_type' => 'SIMPLES',
            'contract_date' => '2026-10-20',
            'first_due_date' => '2026-11-26',
            ...$dados,
        ]), $aberto);
    }

    private function soma(array $parcelas, string $campo): float
    {
        return round(array_sum(array_column($parcelas, $campo)), 2);
    }

    #[Test]
    public function caso_de_referencia_5000_a_2_por_cento_simples_so_juros_dia_26(): void
    {
        $parcelas = $this->gerar([
            'principal' => 5000, 'modality' => 'JUROS_PERIODICOS', 'due_day' => 26, 'installments' => 12,
        ]);

        $this->assertCount(12, $parcelas);
        $this->assertSame('2026-11-26', $parcelas[0]['vencimento']->toDateString());
        $this->assertSame('2026-12-26', $parcelas[1]['vencimento']->toDateString());
        $this->assertSame('2027-10-26', $parcelas[11]['vencimento']->toDateString());

        foreach (array_slice($parcelas, 0, 11) as $parcela) {
            $this->assertSame(100.0, $parcela['valor_juros']);
            $this->assertSame(0.0, $parcela['valor_principal']);
            $this->assertSame(100.0, $parcela['valor_previsto']);
        }

        // O principal volta junto com a última parcela.
        $this->assertSame(5000.0, $parcelas[11]['valor_principal']);
        $this->assertSame(5100.0, $parcelas[11]['valor_previsto']);
    }

    #[Test]
    public function juros_periodicos_sem_numero_de_parcelas_geram_prazo_aberto_sem_devolver_principal(): void
    {
        $parcelas = $this->gerar(['principal' => 5000, 'modality' => 'JUROS_PERIODICOS']);

        $this->assertCount(GeradorCronograma::PARCELAS_PRAZO_ABERTO, $parcelas);
        $this->assertSame(0.0, $this->soma($parcelas, 'valor_principal'));
        $this->assertCount(30, $this->gerar(['modality' => 'JUROS_PERIODICOS'], 30));
    }

    #[Test]
    public function price_gera_parcelas_fixas_e_o_principal_fecha_exato(): void
    {
        $parcelas = $this->gerar(['rate' => 1.5, 'modality' => 'PRICE', 'installments' => 12]);

        $this->assertSame(916.8, $parcelas[0]['valor_previsto']);
        $this->assertSame(916.8, $parcelas[10]['valor_previsto']);
        $this->assertSame(10000.0, $this->soma($parcelas, 'valor_principal'));
        // Juros decrescem e a amortização cresce.
        $this->assertGreaterThan($parcelas[11]['valor_juros'], $parcelas[0]['valor_juros']);
        $this->assertGreaterThan($parcelas[0]['valor_principal'], $parcelas[11]['valor_principal']);
    }

    #[Test]
    public function sac_amortiza_valor_constante_e_parcela_decrescente(): void
    {
        $parcelas = $this->gerar(['rate' => 1, 'modality' => 'SAC', 'installments' => 10]);

        $this->assertSame(1000.0, $parcelas[0]['valor_principal']);
        $this->assertSame(1100.0, $parcelas[0]['valor_previsto']);
        $this->assertSame(1010.0, $parcelas[9]['valor_previsto']);
        $this->assertSame(10000.0, $this->soma($parcelas, 'valor_principal'));
    }

    #[Test]
    public function ultima_parcela_absorve_a_diferenca_de_arredondamento(): void
    {
        $parcelas = $this->gerar(['principal' => 1000, 'rate' => 0, 'interest_type' => 'SEM_JUROS', 'modality' => 'SAC', 'installments' => 3]);

        $this->assertSame(333.33, $parcelas[0]['valor_previsto']);
        $this->assertSame(333.34, $parcelas[2]['valor_previsto']);
        $this->assertSame(1000.0, $this->soma($parcelas, 'valor_principal'));
    }

    #[Test]
    public function carencia_paga_so_juros_nas_primeiras_parcelas(): void
    {
        $parcelas = $this->gerar(['rate' => 1, 'modality' => 'SAC', 'installments' => 6, 'grace_installments' => 2]);

        $this->assertSame(0.0, $parcelas[0]['valor_principal']);
        $this->assertSame(0.0, $parcelas[1]['valor_principal']);
        $this->assertSame(100.0, $parcelas[1]['valor_previsto']);
        $this->assertGreaterThan(0, $parcelas[2]['valor_principal']);
        $this->assertSame(10000.0, $this->soma($parcelas, 'valor_principal'));
    }

    #[Test]
    public function pagamento_unico_simples_e_composto(): void
    {
        // 90 dias = 3 meses sobre 10.000 a 2% a.m.
        $base = ['modality' => 'PAGAMENTO_UNICO', 'contract_date' => '2026-10-01', 'first_due_date' => '2026-12-30'];

        $simples = $this->gerar([...$base, 'interest_type' => 'SIMPLES']);
        $composto = $this->gerar([...$base, 'interest_type' => 'COMPOSTO']);

        $this->assertCount(1, $simples);
        $this->assertSame(10000.0, $simples[0]['valor_principal']);
        $this->assertSame(600.0, $simples[0]['valor_juros']);
        $this->assertSame(612.08, $composto[0]['valor_juros']);
    }

    #[Test]
    public function parcelas_livres_sao_ordenadas_e_numeradas(): void
    {
        $parcelas = $this->gerar([
            'modality' => 'LIVRE',
            'custom_installments' => [
                ['due_date' => '2027-02-10', 'principal_amount' => 6000, 'interest_amount' => 50],
                ['due_date' => '2027-01-10', 'principal_amount' => 4000],
            ],
        ]);

        $this->assertSame('2027-01-10', $parcelas[0]['vencimento']->toDateString());
        $this->assertSame(1, $parcelas[0]['numero']);
        $this->assertSame(6050.0, $parcelas[1]['valor_previsto']);
    }

    #[Test]
    public function exige_numero_de_parcelas_no_price_e_valor_positivo(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->gerar(['modality' => 'PRICE']);
    }

    #[Test]
    public function rejeita_principal_zerado(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->gerar(['principal' => 0, 'modality' => 'JUROS_PERIODICOS', 'installments' => 3]);
    }

    #[Test]
    public function conversao_de_taxas_simples_e_composta(): void
    {
        $this->assertEqualsWithDelta(0.02, Juros::taxaMensal(24, PeriodoTaxa::ANO, TipoJuros::SIMPLES), 1e-9);
        $this->assertEqualsWithDelta(0.018, Juros::taxaMensal(0.06, PeriodoTaxa::DIA, TipoJuros::SIMPLES), 1e-9);
        // 12,6825% a.a. composto equivale a 1% a.m.
        $this->assertEqualsWithDelta(0.01, Juros::taxaMensal(12.682503, PeriodoTaxa::ANO, TipoJuros::COMPOSTO), 1e-6);
        $this->assertSame(0.0, Juros::taxaMensal(5, PeriodoTaxa::MES, TipoJuros::SEM_JUROS));
        $this->assertEqualsWithDelta(0.01, Juros::taxaPorPeriodo(2, PeriodoTaxa::MES, TipoJuros::SIMPLES, FrequenciaEmprestimo::QUINZENAL), 1e-9);
    }

    #[Test]
    public function arredondamento_nao_perde_centavo_por_ruido_de_ponto_flutuante(): void
    {
        $this->assertSame(1.01, Juros::arredondar(1.005));
        $this->assertSame(2.68, Juros::arredondar(2.675));
    }

    #[Test]
    public function ajusta_dia_que_nao_existe_no_mes(): void
    {
        $primeiro = Carbon::parse('2026-10-31');

        $ultimo = new RegraVencimento(FrequenciaEmprestimo::MENSAL, $primeiro, 31, RegraVencimento::ULTIMO_DIA_MES);
        $this->assertSame('2026-11-30', $ultimo->data(1)->toDateString());
        $this->assertSame('2027-02-28', $ultimo->data(4)->toDateString());

        $proximo = new RegraVencimento(FrequenciaEmprestimo::MENSAL, $primeiro, 31, RegraVencimento::PROXIMO_DIA);
        $this->assertSame('2026-12-01', $proximo->data(1)->toDateString());

        // 28/02/2027 é domingo: o último dia útil anterior é sexta, 26/02.
        $util = new RegraVencimento(FrequenciaEmprestimo::MENSAL, $primeiro, 31, RegraVencimento::ULTIMO_DIA_UTIL);
        $this->assertSame('2027-02-26', $util->data(4)->toDateString());
    }

    #[Test]
    public function frequencias_nao_mensais_somam_intervalos_fixos(): void
    {
        $inicio = Carbon::parse('2026-11-01');

        $this->assertSame('2026-11-15', (new RegraVencimento(FrequenciaEmprestimo::QUINZENAL, $inicio))->data(1)->toDateString());
        $this->assertSame('2026-11-22', (new RegraVencimento(FrequenciaEmprestimo::SEMANAL, $inicio))->data(3)->toDateString());
        $this->assertSame('2028-11-01', (new RegraVencimento(FrequenciaEmprestimo::ANUAL, $inicio))->data(2)->toDateString());
    }
}
