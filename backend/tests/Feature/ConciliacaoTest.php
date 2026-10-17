<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Cartao;
use App\Models\Conta;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Models\Transferencia;
use App\Notificacoes\Regras\ConciliacaoPendenteRegra;
use App\Queries\SaldoContaQuery;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConciliacaoTest extends TestCase
{
    use RefreshDatabase;

    private Conta $conta;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-09-25');
        Storage::fake('local');

        $this->conta = Conta::factory()->create(['role' => 'conta corrente']);
        Sanctum::actingAs($this->conta->user);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    // -=-=-=- APOIO -=-=-=-

    /**
     * @param array<int, array{0: string, 1: float, 2: string, 3?: string}> $linhas [data, valor (negativo = saída), nome, fitid]
     */
    private function ofx(array $linhas, ?float $saldo = null, string $acctId = '99887-6'): UploadedFile
    {
        $trns = '';

        foreach ($linhas as $i => $linha) {
            [$data, $valor, $nome] = $linha;
            $fitid = $linha[3] ?? 'F' . str_replace('-', '', $data) . $i;
            $trns .= "<STMTTRN>\n<TRNTYPE>" . ($valor < 0 ? 'DEBIT' : 'CREDIT') . "\n"
                . '<DTPOSTED>' . str_replace('-', '', $data) . "120000\n"
                . '<TRNAMT>' . number_format($valor, 2, '.', '') . "\n"
                . "<FITID>{$fitid}\n<NAME>{$nome}\n</STMTTRN>\n";
        }

        $ledger = $saldo === null ? '' : "<LEDGERBAL>\n<BALAMT>" . number_format($saldo, 2, '.', '') . "\n<DTASOF>20260831\n</LEDGERBAL>\n";

        $conteudo = "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\n"
            . "COMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE\n\n<OFX>\n<BANKMSGSRSV1>\n<STMTTRNRS>\n<TRNUID>1\n"
            . "<STATUS>\n<CODE>0\n<SEVERITY>INFO\n</STATUS>\n<STMTRS>\n<CURDEF>BRL\n<BANKACCTFROM>\n<BANKID>0077\n"
            . "<ACCTID>{$acctId}\n<ACCTTYPE>CHECKING\n</BANKACCTFROM>\n<BANKTRANLIST>\n<DTSTART>20260801\n<DTEND>20260831\n"
            . $trns . "</BANKTRANLIST>\n{$ledger}</STMTRS>\n</STMTTRNRS>\n</BANKMSGSRSV1>\n</OFX>\n";

        return UploadedFile::fake()->createWithContent('extrato.ofx', $conteudo);
    }

    private function enviar(UploadedFile $arquivo, array $extra = [])
    {
        return $this->postJson('/api/conciliacoes', array_merge([
            'arquivo' => $arquivo,
            'conta_id' => $this->conta->id,
            'mes' => '2026-08',
        ], $extra));
    }

    private function lancamento(float $valor, string $data, string $descricao, TransactionType $tipo = TransactionType::EXPENSE): Transacao
    {
        return Transacao::create([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'type' => $tipo, 'amount' => $valor, 'description' => $descricao,
            'status' => TransactionStatus::PAID, 'date' => $data, 'due_date' => $data,
        ]);
    }

    private function cartao(): Cartao
    {
        return Cartao::create([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);
    }

    /** Compra que cai na fatura de agosto (vence 20/08). */
    private function comprar(Cartao $cartao, float $valor, string $tipo = 'EXPENSE'): void
    {
        $this->postJson('/api/transacoes/cartao', [
            'card_id' => $cartao->id, 'description' => $tipo === 'INCOME' ? 'Estorno' : 'Compra',
            'amount' => $valor, 'purchase_date' => '2026-08-05', 'type' => $tipo,
        ])->assertStatus(201);
    }

    private function faturaDeAgosto(Cartao $cartao): Fatura
    {
        return Fatura::where('card_id', $cartao->id)->whereDate('reference_month', '2026-08-01')->firstOrFail();
    }

    private function item(array $revisao, string $descricao): array
    {
        return collect($revisao['itens'])->firstWhere('description', $descricao);
    }

    // -=-=-=- ENVIO E CONCILIAÇÃO AUTOMÁTICA -=-=-=-

    #[Test]
    public function envia_extrato_e_concilia_sozinho_o_que_bate(): void
    {
        $pix = $this->lancamento(38, '2026-08-05', 'João');
        $salario = $this->lancamento(1500, '2026-08-11', 'Salário', TransactionType::INCOME);

        $revisao = $this->enviar($this->ofx([
            ['2026-08-05', -38, 'PIX JOAO FERREIRA', 'A1'],
            ['2026-08-10', 1500, 'SALARIO EMPRESA XYZ', 'A2'],
            ['2026-08-12', -87.40, 'PIX MERCADO SAO JOAO', 'A3'],
            ['2026-09-02', -10, 'FORA DO MES', 'A4'],
        ]))->assertStatus(201)
            ->assertJsonPath('importacao.novas', 3)
            ->assertJsonPath('importacao.fora_do_periodo', 1)
            ->assertJsonPath('importacao.auto_conciliadas', 2)
            ->json('data');

        $this->assertSame(2, $revisao['resumo']['conciliadas']);
        $this->assertSame(1, $revisao['resumo']['pendentes']);
        $this->assertFalse($revisao['pode_finalizar']);

        // O FITID passa para o lançamento: a importação OFX também o reconhece daqui em diante.
        $this->assertSame('A1', $pix->fresh()->fitid);
        $this->assertNotNull($salario->fresh()->reconciliation_item_id);
    }

    #[Test]
    public function pede_a_conta_e_lembra_dela_no_proximo_envio(): void
    {
        $this->enviar($this->ofx([['2026-08-05', -38, 'PIX']]), ['conta_id' => null])
            ->assertStatus(422)
            ->assertJsonPath('necessita_conta', true);

        $this->enviar($this->ofx([['2026-08-05', -38, 'PIX']]), ['lembrar_conta' => true])->assertStatus(201);

        $this->enviar($this->ofx([['2026-08-06', -40, 'PIX 2']]), ['conta_id' => null])->assertStatus(201);
    }

    #[Test]
    public function recusa_extrato_de_cartao_de_credito(): void
    {
        $conteudo = file_get_contents(base_path('tests/Fixtures/Ofx/creditcard_sgml_v1.ofx'));

        $this->enviar(UploadedFile::fake()->createWithContent('cartao.ofx', $conteudo))
            ->assertStatus(422);
    }

    #[Test]
    public function valor_repetido_vira_sugestao_que_se_aceita_com_um_clique(): void
    {
        $this->lancamento(50, '2026-08-05', 'Almoço');
        $this->lancamento(50, '2026-08-06', 'Farmácia');

        $revisao = $this->enviar($this->ofx([['2026-08-05', -50, 'PIX FULANO']]))->json('data');

        $linha = $this->item($revisao, 'PIX FULANO');
        $this->assertSame('PENDENTE', $linha['status']);
        $this->assertSame('MEDIA', $linha['sugestao']['confianca']);
        $this->assertCount(2, $linha['candidatos']);

        // O lançamento sugerido não aparece também como "só no app" (seria o par certo da linha).
        $this->assertSame(1, $revisao['resumo']['so_no_app']);
        $this->assertNotContains($linha['sugestao']['chave'], array_column($revisao['so_no_app'], 'chave'));

        $this->postJson("/api/conciliacoes/{$revisao['conciliacao']['id']}/aceitar-sugestoes")
            ->assertOk()
            ->assertJsonPath('data.resumo.conciliadas', 1);
    }

    #[Test]
    public function lancar_agora_cria_o_lancamento_pago_e_concilia(): void
    {
        $revisao = $this->enviar($this->ofx([['2026-08-12', -87.40, 'PIX MERCADO SAO JOAO', 'M1']]))->json('data');
        $linha = $this->item($revisao, 'PIX MERCADO SAO JOAO');

        $this->postJson("/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/lancar", [
            'description' => 'Mercado', 'category_name' => 'Alimentação',
        ])->assertOk()->assertJsonPath('data.resumo.pendentes', 0);

        $this->assertDatabaseHas('transactions', [
            'account_id' => $this->conta->id, 'description' => 'Mercado', 'amount' => 87.40,
            'type' => 'EXPENSE', 'status' => 'PAID', 'fitid' => 'M1',
        ]);
        $this->assertSame(-87.4, SaldoContaQuery::calcularSaldo($this->conta->id));
    }

    #[Test]
    public function vincular_com_valor_diferente_so_passa_corrigindo_o_lancamento(): void
    {
        $lancamento = $this->lancamento(80, '2026-08-12', 'Mercado');
        $revisao = $this->enviar($this->ofx([['2026-08-12', -87.40, 'PIX MERCADO']]))->json('data');
        $linha = $this->item($revisao, 'PIX MERCADO');
        $url = "/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/vincular";

        $this->postJson($url, ['chave' => "t:{$lancamento->id}"])
            ->assertStatus(422)
            ->assertJsonPath('diferenca', 7.4);

        $this->postJson($url, ['chave' => "t:{$lancamento->id}", 'ajustar_valor' => true])->assertOk();

        $this->assertEquals(87.40, (float) $lancamento->fresh()->amount);
    }

    // -=-=-=- TRANSFERÊNCIA ENTRE CONTAS -=-=-=-

    #[Test]
    public function transferencia_ja_lancada_concilia_sozinha(): void
    {
        $poupanca = Conta::factory()->create(['user_id' => $this->conta->user_id]);
        $this->postJson('/api/transferencias/criar', [
            'from_account_id' => $this->conta->id, 'to_account_id' => $poupanca->id,
            'amount' => 500, 'date' => '2026-08-10', 'description' => 'Guardar',
        ])->assertStatus(201);

        $this->enviar($this->ofx([['2026-08-10', -500, 'TED MESMA TITULARIDADE']]))
            ->assertStatus(201)
            ->assertJsonPath('data.resumo.conciliadas', 1);
    }

    #[Test]
    public function transferencia_lancada_pela_conciliacao_cria_os_dois_lados_e_o_outro_casa_sozinho(): void
    {
        $poupanca = Conta::factory()->create(['user_id' => $this->conta->user_id, 'role' => 'poupança']);
        $revisao = $this->enviar($this->ofx([['2026-08-10', -500, 'TED MESMA TITULARIDADE']]))->json('data');
        $linha = $this->item($revisao, 'TED MESMA TITULARIDADE');
        $url = "/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/transferencia";

        $this->postJson($url, ['conta_id' => $this->conta->id])->assertStatus(422);

        $this->postJson($url, ['conta_id' => $poupanca->id, 'description' => 'Reserva'])
            ->assertOk()
            ->assertJsonPath('data.resumo.conciliadas', 1);

        $transferencia = Transferencia::sole();
        $this->assertSame($this->conta->id, $transferencia->from_account_id);
        $this->assertSame($poupanca->id, $transferencia->to_account_id);
        $this->assertSame(500.0, SaldoContaQuery::calcularSaldo($poupanca->id));

        // Transferência não é despesa: não aparece na listagem de despesas.
        $this->assertCount(0, $this->getJson('/api/transacoes?type=EXPENSE')->json('data'));

        // O extrato da poupança traz a entrada: casa sozinho com o outro lado.
        $this->enviar($this->ofx([['2026-08-10', 500, 'TED RECEBIDA']], acctId: '555-1'), ['conta_id' => $poupanca->id])
            ->assertStatus(201)
            ->assertJsonPath('data.resumo.conciliadas', 1);
    }

    // -=-=-=- FATURA: N COMPRAS NO APP = 1 DÉBITO NO BANCO -=-=-=-

    #[Test]
    public function pagamento_de_fatura_casa_com_a_soma_das_compras_inclusive_estorno(): void
    {
        $cartao = $this->cartao();
        $this->comprar($cartao, 100);
        $this->comprar($cartao, 50);
        $this->comprar($cartao, 30, 'INCOME');
        $fatura = $this->faturaDeAgosto($cartao);
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-08-20'])->assertOk();

        $revisao = $this->enviar($this->ofx([['2026-08-21', -120, 'PAGTO FATURA CARTAO NUBANK']]))->json('data');

        $linha = $this->item($revisao, 'PAGTO FATURA CARTAO NUBANK');
        $this->assertSame('CONCILIADO', $linha['status']);
        $this->assertSame($fatura->id, $linha['invoice_id']);
        $this->assertCount(3, $linha['lancamentos']);
        $this->assertSame(0, Transacao::where('invoice_id', $fatura->id)->whereNull('reconciliation_item_id')->count());
    }

    #[Test]
    public function fatura_que_nao_foi_marcada_como_paga_e_paga_pela_conciliacao(): void
    {
        $cartao = $this->cartao();
        $this->comprar($cartao, 150);
        $fatura = $this->faturaDeAgosto($cartao);

        $revisao = $this->enviar($this->ofx([['2026-08-20', -150, 'PAGTO FATURA']]))->json('data');
        $linha = $this->item($revisao, 'PAGTO FATURA');
        $this->assertSame('PENDENTE', $linha['status']);
        $this->assertSame($fatura->id, $revisao['faturas'][0]['id']);

        $this->postJson("/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/pagamento-fatura", [
            'invoice_id' => $fatura->id,
        ])->assertOk()->assertJsonPath('message', 'Fatura marcada como paga e conciliada.');

        $this->assertSame(0, Transacao::where('invoice_id', $fatura->id)->where('status', 'PENDING')->count());
        $this->assertSame('2026-08-20', Transacao::where('invoice_id', $fatura->id)->first()->date->toDateString());
    }

    #[Test]
    public function debito_menor_que_a_fatura_vira_pagamento_parcial_com_rolagem(): void
    {
        $cartao = $this->cartao();
        $this->comprar($cartao, 1000);
        $fatura = $this->faturaDeAgosto($cartao);

        $revisao = $this->enviar($this->ofx([['2026-08-20', -400, 'PAGTO FATURA']]))->json('data');
        $linha = $this->item($revisao, 'PAGTO FATURA');

        $this->postJson("/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/pagamento-fatura", [
            'invoice_id' => $fatura->id,
        ])->assertOk()->assertJsonPath('data.resumo.conciliadas', 1);

        $this->assertSame(-400.0, SaldoContaQuery::calcularSaldo($this->conta->id));
        $this->assertEquals(600, Transferencia::sole()->amount);
    }

    #[Test]
    public function debito_maior_que_a_fatura_lanca_o_ajuste_que_faltava_e_paga(): void
    {
        $cartao = $this->cartao();
        $this->comprar($cartao, 100);
        $fatura = $this->faturaDeAgosto($cartao);

        $revisao = $this->enviar($this->ofx([['2026-08-20', -112.50, 'PAGTO FATURA']]))->json('data');
        $linha = $this->item($revisao, 'PAGTO FATURA');

        $this->postJson("/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/pagamento-fatura", [
            'invoice_id' => $fatura->id, 'ajuste_descricao' => 'IOF compra internacional',
        ])->assertOk();

        $this->assertDatabaseHas('transactions', [
            'invoice_id' => $fatura->id, 'description' => 'IOF compra internacional', 'amount' => 12.5, 'status' => 'PAID',
        ]);
        $this->assertSame(-112.5, SaldoContaQuery::calcularSaldo($this->conta->id));
    }

    #[Test]
    public function fatura_ja_paga_com_valor_e_data_diferentes_e_ajustada_na_baixa(): void
    {
        $cartao = $this->cartao();
        $this->comprar($cartao, 100);
        $fatura = $this->faturaDeAgosto($cartao);
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-08-12'])->assertOk();

        $revisao = $this->enviar($this->ofx([['2026-08-20', -95, 'PAGTO FATURA']]))->json('data');
        $linha = $this->item($revisao, 'PAGTO FATURA');
        $this->assertSame('PENDENTE', $linha['status']);

        $this->postJson("/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/pagamento-fatura", [
            'invoice_id' => $fatura->id,
        ])->assertOk();

        // Crédito de 5 (sobrava na fatura do app) e a baixa movida para a data do banco.
        $this->assertDatabaseHas('transactions', ['invoice_id' => $fatura->id, 'type' => 'INCOME', 'amount' => 5]);
        $this->assertSame(0, Transacao::where('invoice_id', $fatura->id)->whereDate('date', '2026-08-12')->count());
        $this->assertSame(-95.0, SaldoContaQuery::calcularSaldo($this->conta->id));
    }

    // -=-=-=- FECHAMENTO -=-=-=-

    #[Test]
    public function adiada_segura_o_fechamento_e_reconferir_resolve_depois_de_lancar(): void
    {
        $revisao = $this->enviar($this->ofx([['2026-08-12', -87.40, 'PIX MERCADO']]))->json('data');
        $id = $revisao['conciliacao']['id'];
        $linha = $this->item($revisao, 'PIX MERCADO');

        $this->postJson("/api/conciliacoes/{$id}/itens/{$linha['id']}/adiar", ['note' => 'Ver nota fiscal'])
            ->assertOk()
            ->assertJsonPath('data.resumo.adiadas', 1);

        $this->assertCount(1, (new ConciliacaoPendenteRegra())->verificar($this->conta->user));

        $this->postJson("/api/conciliacoes/{$id}/finalizar")->assertStatus(422);

        // Lançou depois, pela tela normal de despesas.
        $this->lancamento(87.40, '2026-08-12', 'Mercado');

        $this->postJson("/api/conciliacoes/{$id}/reconferir")
            ->assertOk()
            ->assertJsonPath('data.resumo.adiadas', 0)
            ->assertJsonPath('data.pode_finalizar', true);

        $this->postJson("/api/conciliacoes/{$id}/finalizar")
            ->assertOk()
            ->assertJsonPath('data.conciliacao.status', 'FINALIZADA')
            ->assertJsonPath('data.conciliacao.summary.conciliadas_automaticamente', 1);
    }

    #[Test]
    public function lancamento_so_no_app_precisa_de_decisao_para_fechar(): void
    {
        $this->lancamento(20, '2026-08-15', 'Feira em dinheiro');
        $revisao = $this->enviar($this->ofx([['2026-08-12', 100, 'PIX RECEBIDO']]))->json('data');
        $id = $revisao['conciliacao']['id'];

        $this->assertSame(1, $revisao['resumo']['so_no_app']);
        $chave = $revisao['so_no_app'][0]['chave'];

        $linha = $this->item($revisao, 'PIX RECEBIDO');
        $this->postJson("/api/conciliacoes/{$id}/itens/{$linha['id']}/ignorar")->assertStatus(422);
        $this->postJson("/api/conciliacoes/{$id}/itens/{$linha['id']}/ignorar", ['note' => 'Devolução, contestada'])->assertOk();

        $this->postJson("/api/conciliacoes/{$id}/finalizar")
            ->assertStatus(422)
            ->assertJsonPath('pendencias.so_no_app', 1);

        $this->postJson("/api/conciliacoes/{$id}/so-no-app/manter", ['chaves' => [$chave], 'note' => 'Lançado na conta errada, corrijo depois'])
            ->assertOk()
            ->assertJsonPath('data.resumo.so_no_app', 0);

        $this->postJson("/api/conciliacoes/{$id}/finalizar")
            ->assertOk()
            ->assertJsonPath('data.conciliacao.summary.mantidos_so_no_app', 1)
            ->assertJsonPath('data.conciliacao.summary.ignoradas', 1);
    }

    #[Test]
    public function saldo_diferente_do_banco_exige_observacao(): void
    {
        $this->lancamento(38, '2026-08-05', 'João');

        $id = $this->enviar($this->ofx([['2026-08-05', -38, 'PIX JOAO']], saldo: 1000))->json('data.conciliacao.id');

        $this->getJson("/api/conciliacoes/{$id}")
            ->assertOk()
            ->assertJsonPath('data.saldo.app', -38)
            ->assertJsonPath('data.saldo.diferenca', 1038);

        $this->postJson("/api/conciliacoes/{$id}/finalizar")
            ->assertStatus(422)
            ->assertJsonPath('exige_observacao', true);

        $this->postJson("/api/conciliacoes/{$id}/finalizar", ['observacao' => 'Saldo inicial da conta errado'])
            ->assertOk()
            ->assertJsonPath('data.conciliacao.note', 'Saldo inicial da conta errado');
    }

    #[Test]
    public function finalizada_fica_travada_ate_reabrir(): void
    {
        $this->lancamento(38, '2026-08-05', 'João');
        $id = $this->enviar($this->ofx([['2026-08-05', -38, 'PIX JOAO']]))->json('data.conciliacao.id');
        $this->postJson("/api/conciliacoes/{$id}/finalizar")->assertOk();

        $this->enviar($this->ofx([['2026-08-06', -1, 'OUTRO']]))->assertStatus(409);
        $this->postJson("/api/conciliacoes/{$id}/reconferir")->assertStatus(409);
        $this->deleteJson("/api/conciliacoes/{$id}")->assertStatus(409);

        $this->postJson("/api/conciliacoes/{$id}/reabrir")->assertOk()->assertJsonPath('data.conciliacao.status', 'ABERTA');
    }

    #[Test]
    public function lancamento_alterado_depois_de_conciliado_e_detectado_e_desfeito_ao_reconferir(): void
    {
        $pix = $this->lancamento(38, '2026-08-05', 'João');
        $id = $this->enviar($this->ofx([['2026-08-05', -38, 'PIX JOAO']]))->json('data.conciliacao.id');

        $pix->update(['amount' => 40]);

        $this->getJson("/api/conciliacoes/{$id}")->assertJsonPath('data.resumo.vinculos_quebrados', 1);

        $this->postJson("/api/conciliacoes/{$id}/reconferir")
            ->assertOk()
            ->assertJsonPath('data.resumo.pendentes', 1)
            ->assertJsonPath('data.resumo.vinculos_quebrados', 0);

        $this->assertNull($pix->fresh()->reconciliation_item_id);
    }

    #[Test]
    public function reenviar_extrato_mais_completo_so_acrescenta_linhas_novas(): void
    {
        $revisao = $this->enviar($this->ofx([['2026-08-05', -38, 'PIX JOAO', 'X1']]))->json('data');
        $linha = $this->item($revisao, 'PIX JOAO');
        $this->postJson("/api/conciliacoes/{$revisao['conciliacao']['id']}/itens/{$linha['id']}/ignorar", ['note' => 'Teste'])->assertOk();

        $this->enviar($this->ofx([['2026-08-05', -38, 'PIX JOAO', 'X1'], ['2026-08-20', -15, 'TARIFA', 'X2']]))
            ->assertStatus(201)
            ->assertJsonPath('importacao.novas', 1)
            ->assertJsonPath('importacao.ja_existentes', 1)
            ->assertJsonPath('data.resumo.ignoradas', 1);
    }

    #[Test]
    public function excluir_a_conciliacao_libera_os_lancamentos(): void
    {
        $pix = $this->lancamento(38, '2026-08-05', 'João');
        $id = $this->enviar($this->ofx([['2026-08-05', -38, 'PIX JOAO']]))->json('data.conciliacao.id');

        $this->deleteJson("/api/conciliacoes/{$id}")->assertOk();

        $this->assertNull($pix->fresh()->reconciliation_item_id);
        $this->assertDatabaseCount('reconciliations', 0);
    }

    #[Test]
    public function painel_lista_contas_e_faturas_do_mes(): void
    {
        $cartao = $this->cartao();
        $this->comprar($cartao, 100);
        $fatura = $this->faturaDeAgosto($cartao);
        $this->postJson("/api/faturas/{$fatura->id}/auditorias", ['bank_total' => 100])->assertStatus(201);

        $painel = $this->getJson('/api/conciliacoes/painel?mes=2026-08')->assertOk()->json('data');

        $this->assertSame('2026-08', $painel['mes']);
        $this->assertSame('SEM_EXTRATO', collect($painel['contas'])->firstWhere('id', $this->conta->id)['situacao']);
        $this->assertSame('CONFERE', $painel['faturas'][0]['auditoria']['status']);
        $this->assertSame(['concluidos' => 1, 'total' => 2], $painel['progresso']);
    }

    #[Test]
    public function nao_acessa_conciliacao_de_outro_usuario(): void
    {
        $revisao = $this->enviar($this->ofx([['2026-08-05', -38, 'PIX JOAO']]))->json('data');
        $id = $revisao['conciliacao']['id'];
        $itemId = $revisao['itens'][0]['id'];

        Sanctum::actingAs(Conta::factory()->create()->user);

        $this->getJson("/api/conciliacoes/{$id}")->assertStatus(403);
        $this->postJson("/api/conciliacoes/{$id}/itens/{$itemId}/adiar")->assertStatus(403);
        $this->deleteJson("/api/conciliacoes/{$id}")->assertStatus(403);
        $this->getJson('/api/conciliacoes')->assertOk()->assertJsonCount(0, 'data');
    }
}
