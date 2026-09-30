<?php

namespace Tests\Unit;

use App\Enums\ComparacaoRelatorio;
use App\Support\Relatorios\PeriodoComparacao;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class PeriodoComparacaoTest extends TestCase
{
    private function calcular(string $inicio, string $fim, ComparacaoRelatorio $modo): ?array
    {
        $r = (new PeriodoComparacao())->calcular(Carbon::parse($inicio), Carbon::parse($fim), $modo);

        return $r ? [$r['inicio']->toDateString(), $r['fim']->toDateString()] : null;
    }

    #[Test]
    public function mes_fechado_compara_com_o_mes_anterior_inteiro(): void
    {
        // Setembro (30 dias) contra agosto (31 dias): o dia 01/08 precisa entrar.
        $this->assertSame(['2026-08-01', '2026-08-31'], $this->calcular('2026-09-01', '2026-09-30', ComparacaoRelatorio::PERIODO_ANTERIOR));
        $this->assertSame(['2026-02-01', '2026-02-28'], $this->calcular('2026-03-01', '2026-03-31', ComparacaoRelatorio::PERIODO_ANTERIOR));
    }

    #[Test]
    public function varios_meses_fechados_comparam_com_o_mesmo_numero_de_meses(): void
    {
        $this->assertSame(['2026-04-01', '2026-06-30'], $this->calcular('2026-07-01', '2026-09-30', ComparacaoRelatorio::PERIODO_ANTERIOR));
        $this->assertSame(['2025-01-01', '2025-12-31'], $this->calcular('2026-01-01', '2026-12-31', ComparacaoRelatorio::PERIODO_ANTERIOR));
    }

    #[Test]
    public function mesmo_periodo_do_ano_anterior_respeita_o_fim_do_mes(): void
    {
        $this->assertSame(['2025-09-01', '2025-09-30'], $this->calcular('2026-09-01', '2026-09-30', ComparacaoRelatorio::MESMO_PERIODO_ANO_ANTERIOR));
        $this->assertSame(['2027-02-01', '2027-02-28'], $this->calcular('2028-02-01', '2028-02-29', ComparacaoRelatorio::MESMO_PERIODO_ANO_ANTERIOR));
    }

    #[Test]
    public function periodo_personalizado_continua_recuando_por_dias(): void
    {
        $this->assertSame(['2026-09-01', '2026-09-10'], $this->calcular('2026-09-11', '2026-09-20', ComparacaoRelatorio::PERIODO_ANTERIOR));
        $this->assertNull($this->calcular('2026-09-01', '2026-09-30', ComparacaoRelatorio::NENHUM));
    }
}
