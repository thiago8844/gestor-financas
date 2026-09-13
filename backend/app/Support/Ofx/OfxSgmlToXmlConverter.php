<?php

namespace App\Support\Ofx;

/**
 * Converte um arquivo OFX SGML (versão 1.x) em XML bem formado, para poder ser
 * percorrido com SimpleXMLElement do mesmo jeito que um OFX XML (versão 2.x).
 *
 * OFX 1.x tem um cabeçalho em texto puro (linhas "CHAVE:valor") seguido de um corpo
 * em SGML onde tags de valor (folha) não são fechadas, ex: `<NAME>PIX JOAO`.
 * Tags de container (que têm filhos), como `<STMTTRN>`, aparecem sozinhas na linha
 * e são fechadas explicitamente mais adiante — essas não devem ganhar fechamento
 * automático.
 */
class OfxSgmlToXmlConverter
{
    /**
     * @return array{header: array<string, string>, xml: string}
     */
    public function converter(string $conteudo): array
    {
        $conteudo = str_replace("\r\n", "\n", $conteudo);
        $conteudo = str_replace("\r", "\n", $conteudo);

        $posicaoOfx = stripos($conteudo, '<OFX>');

        if ($posicaoOfx === false) {
            throw new Exceptions\OfxParseException('Arquivo OFX SGML sem tag <OFX> raiz.');
        }

        $blocoHeader = substr($conteudo, 0, $posicaoOfx);
        $corpo = substr($conteudo, $posicaoOfx);

        $header = $this->parseHeader($blocoHeader);

        if (!str_ends_with($corpo, "\n")) {
            $corpo .= "\n";
        }

        $corpoFechado = preg_replace(
            '/<([A-Za-z0-9_.]+)>([^<\n]+)\n/',
            "<$1>$2</$1>\n",
            $corpo
        );

        return [
            'header' => $header,
            'xml' => '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . $corpoFechado,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function parseHeader(string $blocoHeader): array
    {
        $header = [];

        foreach (explode("\n", $blocoHeader) as $linha) {
            $linha = trim($linha);

            if ($linha === '' || !str_contains($linha, ':')) {
                continue;
            }

            [$chave, $valor] = explode(':', $linha, 2);
            $header[strtoupper(trim($chave))] = trim($valor);
        }

        return $header;
    }
}
