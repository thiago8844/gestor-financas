<?php

namespace Tests\Unit;

use App\Support\Projecao\EstimadorValorVariavel;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class EstimadorValorVariavelTest extends TestCase
{
    #[Test]
    public function sem_historico_nao_estima(): void
    {
        $this->assertNull(EstimadorValorVariavel::estimar([]));
    }

    #[Test]
    public function serie_constante_tem_valor_exato_e_confianca_alta(): void
    {
        $estimativa = EstimadorValorVariavel::estimar(array_fill(0, 8, 150.0));

        $this->assertSame(150.0, $estimativa['valor']);
        $this->assertSame(0.0, $estimativa['desvio']);
        $this->assertSame('ALTA', $estimativa['confianca']);
    }

    #[Test]
    public function um_valor_atipico_nao_contamina_a_estimativa(): void
    {
        // Seis meses em torno de 200 e um mês com multa de 900.
        $estimativa = EstimadorValorVariavel::estimar([210, 190, 900, 205, 195, 200, 198]);

        $this->assertEqualsWithDelta(200, $estimativa['valor'], 8);
        $this->assertSame(6, $estimativa['amostras']);
    }

    #[Test]
    public function meses_recentes_pesam_mais_acompanhando_uma_tendencia(): void
    {
        // Mais recente primeiro: conta subindo 100 → 160.
        $estimativa = EstimadorValorVariavel::estimar([160, 150, 140, 130, 120, 110, 100]);
        $mediaSimples = array_sum([160, 150, 140, 130, 120, 110, 100]) / 7;

        $this->assertGreaterThan($mediaSimples, $estimativa['valor']);
        $this->assertLessThan(160, $estimativa['valor']);
    }

    #[Test]
    public function poucas_amostras_geram_confianca_baixa_e_desvio_conservador(): void
    {
        $estimativa = EstimadorValorVariavel::estimar([100.0]);

        $this->assertSame(100.0, $estimativa['valor']);
        $this->assertSame(30.0, $estimativa['desvio']);
        $this->assertSame('BAIXA', $estimativa['confianca']);
    }

    #[Test]
    public function considera_apenas_as_ultimas_ocorrencias(): void
    {
        // 12 meses recentes de 100 e histórico antigo de 1000: o antigo é ignorado.
        $estimativa = EstimadorValorVariavel::estimar([...array_fill(0, 12, 100.0), ...array_fill(0, 10, 1000.0)]);

        $this->assertSame(100.0, $estimativa['valor']);
    }
}
