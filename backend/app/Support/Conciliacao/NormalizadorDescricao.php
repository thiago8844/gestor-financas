<?php

namespace App\Support\Conciliacao;

use Illuminate\Support\Str;

/**
 * Compara descrições do extrato ("PIX ENVIADO MERCADO SAO JOAO LTDA") com as do app ("Mercado").
 * É só um desempate: quem decide o par é valor + data. Por isso a similaridade é generosa
 * (coeficiente de sobreposição: basta as palavras da descrição menor estarem na maior).
 */
class NormalizadorDescricao
{
    /** Palavras que todo banco coloca e não dizem nada sobre quem recebeu/pagou. */
    private const RUIDO = [
        'PIX', 'ENVIADO', 'ENVIADA', 'RECEBIDO', 'RECEBIDA', 'TRANSFERENCIA', 'TRANSF', 'TED', 'DOC',
        'COMPRA', 'DEBITO', 'CREDITO', 'PAGAMENTO', 'PAGTO', 'PGTO', 'PAG', 'LTDA', 'EIRELI', 'CIA',
        'DE', 'DA', 'DO', 'DAS', 'DOS', 'PARA', 'COM', 'EM', 'POR', 'NO', 'NA',
    ];

    /** @return string[] */
    public static function tokens(?string $descricao): array
    {
        $texto = Str::upper(Str::ascii((string) $descricao));
        $texto = preg_replace('/[^A-Z0-9]+/', ' ', $texto) ?? '';

        $tokens = array_filter(
            explode(' ', $texto),
            fn (string $t) => strlen($t) >= 3 && !ctype_digit($t) && !in_array($t, self::RUIDO, true)
        );

        return array_values(array_unique($tokens));
    }

    /** 0 (nada em comum) a 1 (todas as palavras da descrição menor aparecem na maior). */
    public static function similaridade(?string $a, ?string $b): float
    {
        $ta = self::tokens($a);
        $tb = self::tokens($b);

        if ($ta === [] || $tb === []) {
            return 0.0;
        }

        [$menor, $maior] = count($ta) <= count($tb) ? [$ta, $tb] : [$tb, $ta];
        $comuns = 0;

        foreach ($menor as $token) {
            foreach ($maior as $outro) {
                if ($token === $outro || self::prefixo($token, $outro)) {
                    $comuns++;
                    break;
                }
            }
        }

        return round($comuns / count($menor), 4);
    }

    /** "MERC" ~ "MERCADO": abreviação comum nos extratos (nomes cortados no limite de caracteres). */
    private static function prefixo(string $a, string $b): bool
    {
        if (strlen($a) < 4 || strlen($b) < 4) {
            return false;
        }

        return str_starts_with($a, $b) || str_starts_with($b, $a);
    }
}
