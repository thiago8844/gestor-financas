<?php

namespace App\Support\Ofx;

use App\Enums\TransactionType;
use App\Support\Ofx\Dto\OfxParsedFile;
use App\Support\Ofx\Dto\OfxParsedTransaction;
use App\Support\Ofx\Exceptions\OfxParseException;
use Carbon\Carbon;
use SimpleXMLElement;

/**
 * Percorre um OFX já em XML bem formado (nativo 2.x, ou 1.x convertido pelo
 * OfxSgmlToXmlConverter) e extrai os dados normalizados.
 */
class OfxXmlParser
{
    public function parse(string $xml, ?string $ofxVersion = null): OfxParsedFile
    {
        libxml_use_internal_errors(true);
        libxml_clear_errors();

        $doc = simplexml_load_string($this->escaparEntidadesSoltas($xml));

        if ($doc === false) {
            $erros = array_map(fn ($erro) => trim($erro->message), libxml_get_errors());
            libxml_clear_errors();

            throw new OfxParseException('Não foi possível interpretar o XML do OFX: ' . implode('; ', $erros));
        }

        $stmtrs = $this->localizarStmtrs($doc);

        if ($stmtrs === null) {
            throw new OfxParseException('Nenhum extrato de conta corrente/poupança ou cartão de crédito encontrado no OFX.');
        }

        [$acctFrom, $tranlist, $acctTypePadrao, $stmtrsNode] = $stmtrs;

        $bankId = isset($acctFrom->BANKID) ? trim((string) $acctFrom->BANKID) : null;
        $branchId = isset($acctFrom->BRANCHID) ? trim((string) $acctFrom->BRANCHID) : null;
        $acctId = isset($acctFrom->ACCTID) ? trim((string) $acctFrom->ACCTID) : null;
        $acctType = isset($acctFrom->ACCTTYPE) ? trim((string) $acctFrom->ACCTTYPE) : $acctTypePadrao;

        $periodStart = isset($tranlist->DTSTART) ? $this->parseData((string) $tranlist->DTSTART) : null;
        $periodEnd = isset($tranlist->DTEND) ? $this->parseData((string) $tranlist->DTEND) : null;

        $transacoes = [];

        if (isset($tranlist->STMTTRN)) {
            foreach ($tranlist->STMTTRN as $trn) {
                $transacoes[] = $this->parseTransacao($trn);
            }
        }

        [$saldo, $dataSaldo] = $this->parseSaldoFinal($stmtrsNode);

        return new OfxParsedFile(
            bankId: $bankId,
            branchId: $branchId,
            acctId: $acctId,
            acctType: $acctType,
            ofxVersion: $ofxVersion,
            periodStart: $periodStart,
            periodEnd: $periodEnd,
            transactions: $transacoes,
            ledgerBalance: $saldo,
            ledgerBalanceDate: $dataSaldo,
        );
    }

    /**
     * @return array{0: SimpleXMLElement, 1: SimpleXMLElement, 2: string, 3: SimpleXMLElement}|null
     */
    private function localizarStmtrs(SimpleXMLElement $doc): ?array
    {
        if (isset($doc->BANKMSGSRSV1->STMTTRNRS->STMTRS->BANKACCTFROM)) {
            $stmtrs = $doc->BANKMSGSRSV1->STMTTRNRS->STMTRS;

            return [$stmtrs->BANKACCTFROM, $stmtrs->BANKTRANLIST, 'CHECKING', $stmtrs];
        }

        if (isset($doc->CREDITCARDMSGSRSV1->CCSTMTTRNRS->CCSTMTRS->CCACCTFROM)) {
            $stmtrs = $doc->CREDITCARDMSGSRSV1->CCSTMTTRNRS->CCSTMTRS;

            return [$stmtrs->CCACCTFROM, $stmtrs->BANKTRANLIST, 'CREDITCARD', $stmtrs];
        }

        return null;
    }

    /**
     * Saldo final do extrato (LEDGERBAL). Opcional: vários bancos não mandam, ou mandam zerado;
     * nesse caso a conciliação só não mostra a "prova do saldo".
     *
     * @return array{0: ?float, 1: ?Carbon}
     */
    private function parseSaldoFinal(SimpleXMLElement $stmtrs): array
    {
        if (!isset($stmtrs->LEDGERBAL->BALAMT)) {
            return [null, null];
        }

        $bruto = trim((string) $stmtrs->LEDGERBAL->BALAMT);

        if ($bruto === '' || !is_numeric(str_replace(',', '.', $bruto))) {
            return [null, null];
        }

        $data = null;

        if (isset($stmtrs->LEDGERBAL->DTASOF) && trim((string) $stmtrs->LEDGERBAL->DTASOF) !== '') {
            try {
                $data = $this->parseData((string) $stmtrs->LEDGERBAL->DTASOF);
            } catch (OfxParseException) {
                $data = null;
            }
        }

        return [(float) str_replace(',', '.', $bruto), $data];
    }

    private function parseTransacao(SimpleXMLElement $trn): OfxParsedTransaction
    {
        $valor = (float) str_replace(',', '.', trim((string) $trn->TRNAMT));

        $nome = isset($trn->NAME) ? trim((string) $trn->NAME) : '';
        $memo = isset($trn->MEMO) ? trim((string) $trn->MEMO) : '';
        $descricao = $nome !== '' ? $nome : $memo;

        return new OfxParsedTransaction(
            fitid: isset($trn->FITID) ? trim((string) $trn->FITID) : null,
            datePosted: $this->parseData((string) $trn->DTPOSTED),
            amount: abs($valor),
            type: $valor < 0 ? TransactionType::EXPENSE : TransactionType::INCOME,
            descricaoOriginal: $descricao,
        );
    }

    /**
     * Bancos costumam colocar "&" solto em NAME/MEMO (ex: "AGUA & CIA"), o que quebra
     * o XML se não for escapado — aqui converte apenas os "&" que não fazem parte de
     * uma entidade já válida (&amp;, &lt;, &#123;, etc).
     */
    private function escaparEntidadesSoltas(string $xml): string
    {
        return preg_replace('/&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9A-Fa-f]+);)/', '&amp;', $xml) ?? $xml;
    }

    private function parseData(string $data): Carbon
    {
        // Remove offset de timezone opcional, ex: "20260805120000[-3:BRT]"
        $data = trim((string) preg_replace('/\[.*\]$/', '', trim($data)));

        if ($data === '') {
            throw new OfxParseException('Transação do OFX sem data.');
        }

        $dataParte = substr($data, 0, 8);
        $horaParte = strlen($data) >= 14 ? substr($data, 8, 6) : '000000';

        $carbon = Carbon::createFromFormat('YmdHis', $dataParte . $horaParte);

        if ($carbon === false) {
            throw new OfxParseException("Data inválida no OFX: {$data}");
        }

        return $carbon;
    }
}
