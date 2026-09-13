<?php

namespace Tests\Unit\Ofx;

use App\Enums\TransactionType;
use App\Support\Ofx\Exceptions\OfxParseException;
use App\Support\Ofx\OfxParser;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OfxParserTest extends TestCase
{
    private function fixture(string $nome): string
    {
        return file_get_contents(__DIR__ . '/../../Fixtures/Ofx/' . $nome);
    }

    #[Test]
    public function interpreta_ofx_sgml_1x_com_tags_de_valor_nao_fechadas(): void
    {
        $arquivo = (new OfxParser())->parse($this->fixture('checking_sgml_v1.ofx'));

        $this->assertSame('0001', $arquivo->bankId);
        $this->assertSame('1234567-8', $arquivo->acctId);
        $this->assertSame('CHECKING', $arquivo->acctType);
        $this->assertSame('102', $arquivo->ofxVersion);
        $this->assertSame('2026-08-01', $arquivo->periodStart->toDateString());
        $this->assertSame('2026-08-31', $arquivo->periodEnd->toDateString());

        $this->assertCount(2, $arquivo->transactions);

        $debito = $arquivo->transactions[0];
        $this->assertSame('2026080500001', $debito->fitid);
        $this->assertSame(38.0, $debito->amount);
        $this->assertSame(TransactionType::EXPENSE, $debito->type);
        $this->assertSame('PIX JOAO FERREIRA DA SILVA', $debito->descricaoOriginal);
        $this->assertSame('2026-08-05 12:00:00', $debito->datePosted->toDateTimeString());

        $credito = $arquivo->transactions[1];
        $this->assertSame(1500.0, $credito->amount);
        $this->assertSame(TransactionType::INCOME, $credito->type);
        $this->assertSame('SALARIO EMPRESA XYZ', $credito->descricaoOriginal);
    }

    #[Test]
    public function interpreta_ofx_xml_2x_nativo_de_conta_corrente(): void
    {
        $arquivo = (new OfxParser())->parse($this->fixture('checking_xml_v2.ofx'));

        $this->assertSame('0341', $arquivo->bankId);
        $this->assertSame('98765-4', $arquivo->acctId);
        $this->assertSame('211', $arquivo->ofxVersion);
        $this->assertCount(2, $arquivo->transactions);

        $this->assertSame('XML0000001', $arquivo->transactions[0]->fitid);
        $this->assertSame(129.9, $arquivo->transactions[0]->amount);
        $this->assertSame(TransactionType::EXPENSE, $arquivo->transactions[0]->type);
        $this->assertSame('PAG*SMARTFIT ACADEMIA', $arquivo->transactions[0]->descricaoOriginal);

        $this->assertSame(TransactionType::INCOME, $arquivo->transactions[1]->type);
    }

    #[Test]
    public function interpreta_ofx_sgml_de_cartao_de_credito(): void
    {
        $arquivo = (new OfxParser())->parse($this->fixture('creditcard_sgml_v1.ofx'));

        $this->assertNull($arquivo->bankId);
        $this->assertSame('5555********1234', $arquivo->acctId);
        $this->assertSame('CREDITCARD', $arquivo->acctType);
        $this->assertCount(2, $arquivo->transactions);

        $this->assertSame('NETFLIX.COM', $arquivo->transactions[0]->descricaoOriginal);
        $this->assertSame(TransactionType::EXPENSE, $arquivo->transactions[0]->type);
        $this->assertSame(TransactionType::INCOME, $arquivo->transactions[1]->type);
    }

    #[Test]
    public function converte_charset_cp1252_declarado_no_cabecalho_para_utf8(): void
    {
        $arquivo = (new OfxParser())->parse($this->fixture('checking_sgml_cp1252.ofx'));

        $this->assertSame(
            'PIX JOÃO FERREIRA - AÇAÍ NA FEIRA',
            $arquivo->transactions[0]->descricaoOriginal
        );
    }

    #[Test]
    public function escapa_e_comercial_solto_no_name_e_memo_sem_quebrar_o_xml(): void
    {
        $arquivo = (new OfxParser())->parse($this->fixture('checking_sgml_ampersand.ofx'));

        $this->assertSame('Agua & Cia Teofilo Otoni Bra', $arquivo->transactions[0]->descricaoOriginal);
    }

    #[Test]
    public function interpreta_extrato_real_do_banco_inter_com_tags_ja_fechadas_e_trntype_payment(): void
    {
        $arquivo = (new OfxParser())->parse($this->fixture('real_banco_inter_checking.ofx'));

        $this->assertSame('077', $arquivo->bankId);
        $this->assertSame('0001-9', $arquivo->branchId);
        $this->assertSame('101678282', $arquivo->acctId);
        $this->assertSame('CHECKING', $arquivo->acctType);
        $this->assertSame('2026-06-01', $arquivo->periodStart->toDateString());
        $this->assertSame('2026-06-30', $arquivo->periodEnd->toDateString());

        $this->assertCount(60, $arquivo->transactions);

        // TRNTYPE é "PAYMENT" (não "DEBIT") neste banco — o tipo tem que vir do sinal do TRNAMT.
        $primeiro = $arquivo->transactions[0];
        $this->assertSame('202606300771', $primeiro->fitid);
        $this->assertSame(21.98, $primeiro->amount);
        $this->assertSame(TransactionType::EXPENSE, $primeiro->type);
        $this->assertSame('Supermercados Bh', $primeiro->descricaoOriginal);
        $this->assertSame('2026-06-30', $primeiro->datePosted->toDateString());

        $credito = collect($arquivo->transactions)->firstWhere('fitid', '202606270772');
        $this->assertNotNull($credito);
        $this->assertSame(TransactionType::INCOME, $credito->type);
        $this->assertSame(53.0, $credito->amount);

        // FITID 202606100771 tem <NAME></NAME> vazio: precisa cair pro MEMO.
        $semNome = collect($arquivo->transactions)->firstWhere('fitid', '202606100771');
        $this->assertNotNull($semNome);
        $this->assertStringContainsString('AMAZONCOMBR', $semNome->descricaoOriginal);
    }

    #[Test]
    public function arquivo_vazio_lanca_excecao(): void
    {
        $this->expectException(OfxParseException::class);

        (new OfxParser())->parse('   ');
    }

    #[Test]
    public function ofx_sem_bloco_de_extrato_conhecido_lanca_excecao(): void
    {
        $this->expectException(OfxParseException::class);

        (new OfxParser())->parse(<<<OFX
        OFXHEADER:100
        DATA:OFXSGML
        VERSION:102
        SECURITY:NONE
        ENCODING:USASCII
        CHARSET:1252
        COMPRESSION:NONE
        OLDFILEUID:NONE
        NEWFILEUID:NONE

        <OFX>
        <SIGNONMSGSRSV1>
        <SONRS>
        <STATUS>
        <CODE>0
        <SEVERITY>INFO
        </STATUS>
        </SONRS>
        </SIGNONMSGSRSV1>
        </OFX>
        OFX);
    }
}
