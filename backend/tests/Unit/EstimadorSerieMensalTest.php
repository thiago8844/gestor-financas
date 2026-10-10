<?php

namespace Tests\Unit;

use App\Support\Simulador\EstimadorSerieMensal;
use App\Support\Simulador\PerfilDistribuicaoMensal;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class EstimadorSerieMensalTest extends TestCase
{
    private function meses(int $n, string $ultimo = '2026-09'): array
    {
        $meses = [];
        for ($i = $n - 1; $i >= 0; $i--) {
            $meses[] = Carbon::parse("{$ultimo}-01")->subMonthsNoOverflow($i)->format('Y-m');
        }

        return $meses;
    }

    #[Test]
    public function serie_estavel_gera_previsao_estavel_com_confianca_alta(): void
    {
        $serie = [650, 720, 680, 710, 690, 740, 700, 705];
        $r = EstimadorSerieMensal::estimar($serie, false, $this->meses(8));

        $this->assertSame('PROJETADA', $r['status']);
        $this->assertEqualsWithDelta(705, $r['valor'], 25);
        $this->assertSame('ALTA', $r['confianca']);
        $this->assertNotNull($r['validacao']);
        $this->assertSame('ESTAVEL', $r['estatisticas']['tendencia']['classificacao']);
    }

    #[Test]
    public function gasto_esporadico_vira_valor_esperado_por_mes(): void
    {
        // Manutenção de R$ 800 em 3 de 12 meses, sem intervalo fixo ≈ R$ 200/mês esperados, confiança baixa.
        $serie = [0, 0, 800, 0, 0, 800, 0, 0, 0, 0, 800, 0];
        $r = EstimadorSerieMensal::estimar($serie, false, $this->meses(12));

        $this->assertSame('PROJETADA', $r['status']);
        $this->assertGreaterThan(100, $r['valor']);
        $this->assertLessThan(350, $r['valor']);
        $this->assertSame('BAIXA', $r['confianca']);
        $this->assertEqualsWithDelta(0.25, $r['estatisticas']['frequencia'], 0.001);
    }

    #[Test]
    public function tendencia_sustentada_pelo_historico_e_limitada(): void
    {
        $serie = [400, 420, 440, 460, 480, 500, 520, 540, 560, 580, 600, 620];
        $r = EstimadorSerieMensal::estimar($serie, false, $this->meses(12));

        $this->assertSame('tendencia_limitada', $r['metodo']);
        $this->assertGreaterThan(600, $r['valor']);
        $this->assertSame('SUBINDO', $r['estatisticas']['tendencia']['classificacao']);

        // Mesmo 24 meses à frente, a tendência não passa de +25% sobre o nível.
        $longe = EstimadorSerieMensal::prever($r['modelo'], 24);
        $this->assertLessThanOrEqual($r['modelo']['nivel'] * 1.25 + 0.01, $longe);
    }

    #[Test]
    public function validacao_nao_usa_o_futuro_e_mede_erro_ponderado_mesmo_com_zeros(): void
    {
        $serie = [0, 300, 0, 320, 310, 0, 0, 330, 0, 300];
        $r = EstimadorSerieMensal::estimar($serie, false, $this->meses(10));

        $this->assertSame(6, $r['validacao']['meses']);
        $this->assertNotNull($r['validacao']['wape']);
        $this->assertArrayHasKey('media_ponderada_robusta', $r['validacao']['metodos']);
    }

    #[Test]
    public function receita_esporadica_e_eventual_e_pouco_historico_e_insuficiente(): void
    {
        $this->assertSame('EVENTUAL', EstimadorSerieMensal::estimar([0, 3000, 0, 0, 2500, 0], true)['status']);
        $this->assertSame('INSUFICIENTE', EstimadorSerieMensal::estimar([0, 0, 900], false)['status']);
        $this->assertSame('INSUFICIENTE', EstimadorSerieMensal::estimar([], false)['status']);
        $this->assertSame('BAIXA', EstimadorSerieMensal::estimar([200, 260], false)['confianca']);
    }

    #[Test]
    public function ocorrencia_periodica_e_prevista_nos_meses_certos(): void
    {
        // Venda de grãos a cada 3 meses; a última foi há 2 meses (jul, com série até set).
        $serie = [17857, 0, 0, 15716, 0, 0, 15639, 0, 0, 21269, 0, 0];
        $r = EstimadorSerieMensal::estimar($serie, true, $this->meses(12, '2026-09'));

        $this->assertSame('PROJETADA', $r['status']);
        $this->assertSame('periodica', $r['metodo']);
        $this->assertSame(3, $r['estatisticas']['periodo_meses']);
        // h=1 (out) = 2 meses desde jul + 1 → 3 ✓; nov e dez não; jan sim.
        $this->assertGreaterThan(15000, EstimadorSerieMensal::prever($r['modelo'], 1));
        $this->assertSame(0.0, EstimadorSerieMensal::prever($r['modelo'], 2));
        $this->assertSame(0.0, EstimadorSerieMensal::prever($r['modelo'], 3));
        $this->assertGreaterThan(15000, EstimadorSerieMensal::prever($r['modelo'], 4));
    }

    #[Test]
    public function padrao_periodico_interrompido_nao_e_projetado_como_periodico(): void
    {
        // Três ocorrências trimestrais e depois 6 meses sem nada: o padrão parou.
        $serie = [500, 0, 0, 500, 0, 0, 500, 0, 0, 0, 0, 0, 0];
        $r = EstimadorSerieMensal::estimar($serie, false, $this->meses(13));

        $this->assertNotSame('periodica', $r['metodo']);
    }

    #[Test]
    public function perfil_distribui_no_periodo_certo_e_fecha_os_centavos(): void
    {
        $perfil = PerfilDistribuicaoMensal::aPartirDe([[3, 500], [4, 520], [2, 480], [5, 510]]);
        $this->assertSame('INICIO', $perfil['padrao']);

        $partes = PerfilDistribuicaoMensal::distribuir($perfil, 1000.01, '2026-11', 1, 30, 30);
        $this->assertEquals(1000.01, round(array_sum(array_column($partes, 'valor')), 2));
        // Dia mediano ponderado pelo valor (2, 3, 4, 5 → 4).
        $this->assertSame('2026-11-04', $partes[0]['data']);

        // Do dia 10 em diante, só sobra uma fração pequena de um gasto de início de mês.
        $fracao = PerfilDistribuicaoMensal::fracaoNoIntervalo($perfil, 10, 31, 31);
        $this->assertLessThan(0.15, $fracao);

        $neutro = PerfilDistribuicaoMensal::aPartirDe([[3, 100]]);
        $this->assertSame('NEUTRO', $neutro['padrao']);
    }
}
