<?php

namespace App\Support;

use InvalidArgumentException;

/**
 * Divide um valor em parcelas de centavos exatos. A soma das parcelas é sempre igual ao total;
 * o que muda entre os modos é onde os centavos que sobram do arredondamento são colocados,
 * porque cada banco/vendedor faz de um jeito.
 */
class DividirParcelas
{
    public const MODO_ULTIMA = 'ultima';
    public const MODO_PRIMEIRA = 'primeira';
    public const MODO_ESPALHAR = 'espalhar';

    public const MODOS = [self::MODO_ULTIMA, self::MODO_PRIMEIRA, self::MODO_ESPALHAR];

    /**
     * - ultima: todo o resto na última parcela (ex.: 333,33 / 333,33 / 333,34)
     * - primeira: todo o resto na primeira parcela (ex.: 333,34 / 333,33 / 333,33 com 1000 em 3x)
     * - espalhar: 1 centavo a mais nas primeiras parcelas até acabar o resto
     *
     * @return array<int, float>
     */
    public static function dividir(float $valorTotal, int $total, string $modo = self::MODO_ULTIMA): array
    {
        if ($total < 1) {
            throw new InvalidArgumentException('O número de parcelas deve ser pelo menos 1.');
        }

        if (!in_array($modo, self::MODOS, true)) {
            throw new InvalidArgumentException("Modo de distribuição de centavos inválido: {$modo}.");
        }

        $centavosTotal = (int) round($valorTotal * 100);
        $base = intdiv($centavosTotal, $total);
        $resto = $centavosTotal - $base * $total;

        $parcelas = [];

        for ($i = 0; $i < $total; $i++) {
            $extra = match ($modo) {
                self::MODO_ULTIMA => $i === $total - 1 ? $resto : 0,
                self::MODO_PRIMEIRA => $i === 0 ? $resto : 0,
                self::MODO_ESPALHAR => $i < $resto ? 1 : 0,
            };

            $parcelas[] = round(($base + $extra) / 100, 2);
        }

        return $parcelas;
    }

    /** Soma em centavos inteiros, para comparar com o total sem erro de ponto flutuante. */
    public static function somaEmCentavos(array $valores): int
    {
        return array_sum(array_map(fn ($v) => (int) round(((float) $v) * 100), $valores));
    }
}
