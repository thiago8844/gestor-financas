<?php

namespace App\Support\Ofx;

use App\Support\Ofx\Dto\OfxParsedFile;
use App\Support\Ofx\Exceptions\OfxParseException;

/**
 * Ponto de entrada único para interpretar um arquivo OFX (SGML/1.x ou XML/2.x,
 * conta corrente/poupança ou cartão de crédito), devolvendo um DTO normalizado.
 * Classe pura, sem acesso a banco — testável isoladamente com arquivos de fixture.
 */
class OfxParser
{
    public function __construct(
        private readonly OfxSgmlToXmlConverter $sgmlConverter = new OfxSgmlToXmlConverter(),
        private readonly OfxXmlParser $xmlParser = new OfxXmlParser(),
    ) {
    }

    public function parse(string $conteudoBruto): OfxParsedFile
    {
        if (trim($conteudoBruto) === '') {
            throw new OfxParseException('Arquivo OFX vazio.');
        }

        $isXmlNativo = (bool) preg_match('/^\s*<\?xml/i', $conteudoBruto);

        return $isXmlNativo
            ? $this->parseXmlNativo($conteudoBruto)
            : $this->parseSgml($conteudoBruto);
    }

    private function parseSgml(string $conteudoBruto): OfxParsedFile
    {
        $charset = $this->detectarCharsetSgml($conteudoBruto);
        $conteudoUtf8 = $this->converterParaUtf8($conteudoBruto, $charset);

        $convertido = $this->sgmlConverter->converter($conteudoUtf8);

        return $this->xmlParser->parse($convertido['xml'], $convertido['header']['VERSION'] ?? null);
    }

    private function parseXmlNativo(string $conteudoBruto): OfxParsedFile
    {
        $encodingDeclarado = $this->detectarEncodingXml($conteudoBruto);
        $conteudoUtf8 = $this->converterParaUtf8($conteudoBruto, $encodingDeclarado);

        // Depois de converter os bytes para UTF-8, força a declaração a dizer UTF-8
        // para o libxml não tentar reinterpretar/reconverter os bytes.
        $conteudoUtf8 = preg_replace('/encoding="[^"]*"/i', 'encoding="UTF-8"', $conteudoUtf8, 1) ?? $conteudoUtf8;

        $versao = null;
        if (preg_match('/<\?OFX[^>]*VERSION="?(\d+)"?/i', $conteudoUtf8, $m)) {
            $versao = $m[1];
        }

        return $this->xmlParser->parse($conteudoUtf8, $versao);
    }

    private function detectarCharsetSgml(string $conteudoBruto): ?string
    {
        if (preg_match('/^CHARSET:\s*(.+)$/mi', $conteudoBruto, $m)) {
            return trim($m[1]);
        }

        if (preg_match('/^ENCODING:\s*(.+)$/mi', $conteudoBruto, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    private function detectarEncodingXml(string $conteudoBruto): ?string
    {
        if (preg_match('/<\?xml[^>]*encoding="([^"]+)"/i', $conteudoBruto, $m)) {
            return $m[1];
        }

        return null;
    }

    private function converterParaUtf8(string $conteudo, ?string $charsetDeclarado): string
    {
        $mapa = [
            '1252' => 'Windows-1252',
            'CP1252' => 'Windows-1252',
            'WINDOWS-1252' => 'Windows-1252',
            '8859-1' => 'ISO-8859-1',
            'ISO-8859-1' => 'ISO-8859-1',
            'LATIN1' => 'ISO-8859-1',
            'USASCII' => 'ASCII',
            'US-ASCII' => 'ASCII',
        ];

        $chave = strtoupper((string) $charsetDeclarado);
        $encodingOrigem = $mapa[$chave] ?? null;

        if ($encodingOrigem === null || $encodingOrigem === 'ASCII') {
            // Charset UTF-8/ASCII/desconhecido: só garante que a string resultante é UTF-8 válida.
            return mb_check_encoding($conteudo, 'UTF-8')
                ? $conteudo
                : mb_convert_encoding($conteudo, 'UTF-8', 'Windows-1252');
        }

        return mb_convert_encoding($conteudo, 'UTF-8', $encodingOrigem);
    }
}
