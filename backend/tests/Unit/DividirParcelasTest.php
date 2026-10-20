<?php

namespace Tests\Unit;

use App\Support\DividirParcelas;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class DividirParcelasTest extends TestCase
{
    #[Test]
    public function resto_na_ultima_parcela_por_padrao(): void
    {
        $this->assertSame([333.33, 333.33, 333.34], DividirParcelas::dividir(1000, 3));
    }

    #[Test]
    public function resto_na_primeira_parcela(): void
    {
        $this->assertSame([333.34, 333.33, 333.33], DividirParcelas::dividir(1000, 3, DividirParcelas::MODO_PRIMEIRA));
    }

    #[Test]
    public function resto_espalhado_um_centavo_por_parcela(): void
    {
        $this->assertSame([33.34, 33.33, 33.33], DividirParcelas::dividir(100, 3, DividirParcelas::MODO_ESPALHAR));
        $this->assertSame([25.01, 25.01, 25.0, 25.0], DividirParcelas::dividir(100.02, 4, DividirParcelas::MODO_ESPALHAR));
    }

    #[Test]
    public function soma_das_parcelas_sempre_igual_ao_total_em_todos_os_modos(): void
    {
        foreach (DividirParcelas::MODOS as $modo) {
            foreach ([[0.05, 3], [100.00, 7], [1234.56, 12], [0.01, 2], [999999.99, 60]] as [$total, $n]) {
                $parcelas = DividirParcelas::dividir($total, $n, $modo);

                $this->assertCount($n, $parcelas);
                $this->assertSame((int) round($total * 100), DividirParcelas::somaEmCentavos($parcelas), "{$modo} {$total} em {$n}x");
            }
        }
    }

    #[Test]
    public function rejeita_modo_invalido(): void
    {
        $this->expectException(InvalidArgumentException::class);

        DividirParcelas::dividir(10, 2, 'qualquer');
    }
}
