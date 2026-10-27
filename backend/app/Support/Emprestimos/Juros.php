<?php

namespace App\Support\Emprestimos;

use App\Enums\FrequenciaEmprestimo;
use App\Enums\PeriodoTaxa;
use App\Enums\TipoJuros;

/**
 * Conversões de taxa e arredondamento. Funções puras, sem acesso a banco.
 */
class Juros
{
    /** Dias de um mês para juros proporcionais (base 30). */
    public const DIAS_NO_MES = 30;

    /**
     * Taxa mensal (decimal: 2% = 0.02) equivalente à taxa informada.
     * Simples converte proporcionalmente; composto converte por equivalência.
     */
    public static function taxaMensal(float $taxaPercentual, PeriodoTaxa $periodo, TipoJuros $tipo): float
    {
        if ($tipo === TipoJuros::SEM_JUROS || $taxaPercentual <= 0) {
            return 0.0;
        }

        $taxa = $taxaPercentual / 100;

        return match ($periodo) {
            PeriodoTaxa::MES => $taxa,
            PeriodoTaxa::DIA => $tipo === TipoJuros::SIMPLES
                ? $taxa * self::DIAS_NO_MES
                : (1 + $taxa) ** self::DIAS_NO_MES - 1,
            PeriodoTaxa::ANO => $tipo === TipoJuros::SIMPLES
                ? $taxa / 12
                : (1 + $taxa) ** (1 / 12) - 1,
        };
    }

    /**
     * Taxa (decimal) de cada período de pagamento, a partir da taxa mensal equivalente.
     */
    public static function taxaPorPeriodo(
        float $taxaPercentual,
        PeriodoTaxa $periodo,
        TipoJuros $tipo,
        FrequenciaEmprestimo $frequencia,
    ): float {
        $mensal = self::taxaMensal($taxaPercentual, $periodo, $tipo);
        $meses = $frequencia->meses();

        return $tipo === TipoJuros::COMPOSTO
            ? (1 + $mensal) ** $meses - 1
            : $mensal * $meses;
    }

    /**
     * Juros acumulados sobre o principal depois de `$meses` (pode ser fracionário).
     */
    public static function jurosAcumulados(float $principal, float $taxaMensal, float $meses, TipoJuros $tipo): float
    {
        return $tipo === TipoJuros::COMPOSTO
            ? $principal * ((1 + $taxaMensal) ** $meses - 1)
            : $principal * $taxaMensal * $meses;
    }

    public static function arredondar(float $valor): float
    {
        // O arredondamento prévio em 8 casas evita que 1.005 vire 1.00 por ruído de ponto flutuante.
        return round(round($valor, 8), 2);
    }
}
