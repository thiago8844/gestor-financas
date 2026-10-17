<?php

namespace Tests\Feature;

use App\Enums\TipoTransferencia;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Http\Resources\FaturaResource;
use App\Models\Cartao;
use App\Models\Conta;
use App\Models\Fatura;
use App\Models\Transacao;
use App\Models\Transferencia;
use App\Queries\SaldoContaQuery;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FaturaPagamentoTest extends TestCase
{
    use RefreshDatabase;

    private Conta $conta;
    private Cartao $cartao;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-09-25');

        $this->conta = Conta::factory()->create();
        Sanctum::actingAs($this->conta->user);

        // Fecha dia 10, vence dia 20: compra em 05/09 cai na fatura de setembro (vence 20/09).
        $this->cartao = Cartao::create([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function comprar(float $valor, string $data = '2026-09-05', array $extra = []): void
    {
        $this->postJson('/api/transacoes/cartao', array_merge([
            'card_id' => $this->cartao->id,
            'description' => 'Compra',
            'amount' => $valor,
            'purchase_date' => $data,
        ], $extra))->assertStatus(201);
    }

    private function fatura(string $mes = '2026-09-01'): Fatura
    {
        return Fatura::where('card_id', $this->cartao->id)->whereDate('reference_month', $mes)->firstOrFail();
    }

    private function saldo(): float
    {
        return SaldoContaQuery::calcularSaldo($this->conta->id);
    }

    private function resumoDaApi(Fatura $fatura): array
    {
        $faturas = $this->getJson("/api/cartoes/{$this->cartao->id}/faturas")->assertOk()->json('data');

        return collect($faturas)->firstWhere('id', $fatura->id);
    }

    #[Test]
    public function totais_de_fatura_so_com_despesas_sao_identicos_ao_calculo_antigo(): void
    {
        $this->comprar(100.10);
        $this->comprar(55.35);
        $this->comprar(10, '2026-09-06');
        $fatura = $this->fatura();

        // Uma paga e as outras pendentes: o cenário misto que o cálculo antigo também cobria.
        Transacao::where('invoice_id', $fatura->id)->orderBy('id')->first()
            ->update(['status' => TransactionStatus::PAID, 'date' => '2026-09-20']);

        $parcelas = $fatura->fresh()->parcelas;
        $totalAntigo = round((float) $parcelas->sum('amount'), 2);
        $pagoAntigo = round((float) $parcelas->where('status', TransactionStatus::PAID)->sum('amount'), 2);
        $pendenteAntigo = round($totalAntigo - $pagoAntigo, 2);

        $json = FaturaResource::make($fatura->fresh()->load('parcelas'))->resolve();

        $this->assertSame($totalAntigo, $json['total']);
        $this->assertSame($pagoAntigo, $json['pago']);
        $this->assertSame($pendenteAntigo, $json['pendente']);
        $this->assertSame('VENCIDA', $json['status']);
        $this->assertSame(0.0, $json['levado_para_proxima']);
    }

    #[Test]
    public function pagamento_total_continua_debitando_a_fatura_inteira(): void
    {
        $this->comprar(100);
        $this->comprar(50);
        $fatura = $this->fatura();

        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20'])
            ->assertOk()
            ->assertJsonPath('data.status', 'PAGA')
            ->assertJsonPath('data.pago', 150)
            ->assertJsonPath('data.pagamentos.0.data', '2026-09-20');

        $this->assertSame(-150.0, $this->saldo());
        $this->assertSame(0, Transferencia::count());
    }

    #[Test]
    public function estorno_no_cartao_abate_do_total_e_do_debito(): void
    {
        $this->comprar(100);
        $this->comprar(30, '2026-09-07', ['type' => 'INCOME', 'description' => 'Estorno loja']);
        $fatura = $this->fatura();

        $this->assertDatabaseHas('transactions', [
            'invoice_id' => $fatura->id, 'type' => 'INCOME', 'amount' => 30, 'status' => 'PENDING',
        ]);
        $this->assertEquals(70, $this->resumoDaApi($fatura)['total']);
        $this->assertEquals(70, $this->resumoDaApi($fatura)['pendente']);

        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20'])->assertOk();

        $this->assertSame(-70.0, $this->saldo());
    }

    #[Test]
    public function estorno_no_cartao_nao_pode_ser_parcelado(): void
    {
        $this->postJson('/api/transacoes/cartao', [
            'card_id' => $this->cartao->id, 'description' => 'Estorno', 'amount' => 30,
            'purchase_date' => '2026-09-05', 'type' => 'INCOME', 'installment_total' => 3,
        ])->assertStatus(422)->assertJsonValidationErrors('installment_total');
    }

    #[Test]
    public function fatura_so_com_credito_pendente_nao_aparece_como_paga(): void
    {
        $this->comprar(30, '2026-09-07', ['type' => 'INCOME', 'description' => 'Estorno']);

        $this->assertSame('VENCIDA', $this->resumoDaApi($this->fatura())['status']);
    }

    #[Test]
    public function pagamento_parcial_leva_o_restante_para_a_proxima_fatura(): void
    {
        $this->comprar(600);
        $this->comprar(400);
        $fatura = $this->fatura();

        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20', 'amount' => 400])
            ->assertOk()
            ->assertJsonPath('data.status', 'PAGA')
            ->assertJsonPath('data.total', 1000)
            ->assertJsonPath('data.pago', 400)
            ->assertJsonPath('data.levado_para_proxima', 600)
            ->assertJsonPath('data.pagamentos.0.valor', 400);

        // A conta só é debitada do que saiu de verdade.
        $this->assertSame(-400.0, $this->saldo());

        $rolagem = Transferencia::sole();
        $this->assertSame(TipoTransferencia::FATURA, $rolagem->kind);

        $proxima = $this->fatura('2026-10-01');
        $this->assertSame($fatura->id, $rolagem->source_invoice_id);
        $this->assertSame($proxima->id, $rolagem->target_invoice_id);
        $this->assertDatabaseHas('transactions', [
            'invoice_id' => $proxima->id, 'transfer_id' => $rolagem->id,
            'type' => 'EXPENSE', 'amount' => 600, 'status' => 'PENDING',
        ]);
        $this->assertEquals(600, $this->resumoDaApi($proxima)['pendente']);

        // Pagando a próxima, o saldo restante sai da conta.
        $this->postJson("/api/faturas/{$proxima->id}/pagar", ['date' => '2026-10-20'])->assertOk();
        $this->assertSame(-1000.0, $this->saldo());
    }

    #[Test]
    public function rolagem_fica_fora_das_listagens_e_nao_e_editavel_direto(): void
    {
        $this->comprar(1000);
        $fatura = $this->fatura();
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20', 'amount' => 400])->assertOk();

        $this->getJson('/api/transferencias')->assertOk()->assertJsonCount(0, 'data');

        $descricoes = collect($this->getJson('/api/transacoes?limit=100')->json('data'))->pluck('description');
        $this->assertNotContains('Saldo restante da fatura de Setembro/2026', $descricoes);

        $lado = Transacao::whereNotNull('transfer_id')->where('type', TransactionType::EXPENSE)->sole();
        $this->putJson("/api/transacoes/{$lado->id}/valor", ['amount' => 1])
            ->assertStatus(403)
            ->assertJsonPath('message', 'Este lançamento é o saldo de um pagamento parcial de fatura. Para desfazê-lo, reverta o pagamento da fatura.');
        $this->deleteJson("/api/transacoes/deletar/{$lado->id}")->assertStatus(403);
        $this->getJson("/api/transferencias/{$lado->transfer_id}")->assertStatus(403);
    }

    #[Test]
    public function pagamento_maior_que_o_pendente_e_recusado(): void
    {
        $this->comprar(100);

        $this->postJson("/api/faturas/{$this->fatura()->id}/pagar", ['date' => '2026-09-20', 'amount' => 150])
            ->assertStatus(422);

        $this->assertSame(0.0, $this->saldo());
    }

    #[Test]
    public function reverter_pagamento_parcial_desfaz_a_rolagem(): void
    {
        $this->comprar(1000);
        $fatura = $this->fatura();
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20', 'amount' => 400])->assertOk();

        $this->postJson("/api/faturas/{$fatura->id}/reverter")
            ->assertOk()
            ->assertJsonPath('data.pendente', 1000)
            ->assertJsonPath('data.levado_para_proxima', 0);

        $this->assertSame(0, Transferencia::count());
        $this->assertSame(0, Transacao::whereNotNull('transfer_id')->count());
        $this->assertSame(0.0, $this->saldo());
    }

    #[Test]
    public function nao_reverte_se_a_proxima_fatura_ja_pagou_o_saldo(): void
    {
        $this->comprar(1000);
        $fatura = $this->fatura();
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20', 'amount' => 400])->assertOk();
        $this->postJson("/api/faturas/{$this->fatura('2026-10-01')->id}/pagar", ['date' => '2026-10-20'])->assertOk();

        $this->postJson("/api/faturas/{$fatura->id}/reverter")
            ->assertStatus(422)
            ->assertJsonPath('message', 'O saldo desta fatura já foi pago junto com a fatura de Outubro/2026. Reverta o pagamento dela primeiro.');
    }

    #[Test]
    public function lancar_em_fatura_paga_nasce_pago_na_data_do_pagamento(): void
    {
        $this->comprar(100);
        $fatura = $this->fatura();
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20'])->assertOk();

        $this->postJson("/api/faturas/{$fatura->id}/lancamentos", [
            'type' => 'EXPENSE', 'amount' => 12.5, 'description' => 'IOF',
        ])->assertStatus(201)->assertJsonPath('data.status', 'PAGA')->assertJsonPath('data.total', 112.5);

        $this->assertDatabaseHas('transactions', [
            'invoice_id' => $fatura->id, 'description' => 'IOF', 'status' => 'PAID',
        ]);
        $this->assertSame('2026-09-20', Transacao::where('description', 'IOF')->sole()->date->toDateString());
        $this->assertSame(-112.5, $this->saldo());
    }

    #[Test]
    public function ajuste_em_fatura_paga_parcialmente_vai_para_o_saldo_levado_e_nao_para_a_conta(): void
    {
        $this->comprar(1000);
        $fatura = $this->fatura();
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-09-20', 'amount' => 400])->assertOk();

        // O banco cobrou 12,50 de IOF que faltava: a fatura passa a 1012,50, mas só saíram 400 da conta.
        $this->postJson("/api/faturas/{$fatura->id}/lancamentos", [
            'type' => 'EXPENSE', 'amount' => 12.5, 'description' => 'IOF',
        ])->assertStatus(201)
            ->assertJsonPath('data.total', 1012.5)
            ->assertJsonPath('data.pago', 400)
            ->assertJsonPath('data.levado_para_proxima', 612.5);

        $this->assertSame(-400.0, $this->saldo());
        $this->assertEquals(612.5, $this->resumoDaApi($this->fatura('2026-10-01'))['pendente']);
    }

    #[Test]
    public function lancar_credito_em_fatura_aberta_nasce_pendente(): void
    {
        $this->comprar(100);
        $fatura = $this->fatura();

        $this->postJson("/api/faturas/{$fatura->id}/lancamentos", [
            'type' => 'INCOME', 'amount' => 20, 'description' => 'Estorno',
        ])->assertStatus(201)->assertJsonPath('data.pendente', 80);

        $this->assertDatabaseHas('transactions', ['description' => 'Estorno', 'status' => 'PENDING', 'type' => 'INCOME']);
    }

    #[Test]
    public function auditoria_sinaliza_diferenca_e_passa_a_conferir_depois_do_ajuste(): void
    {
        $this->comprar(100);
        $fatura = $this->fatura();

        $this->postJson("/api/faturas/{$fatura->id}/auditorias", ['bank_total' => 112.5, 'note' => 'PDF do banco'])
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'DIVERGENTE')
            ->assertJsonPath('data.diferenca_atual', 12.5);

        $this->postJson("/api/faturas/{$fatura->id}/lancamentos", [
            'type' => 'EXPENSE', 'amount' => 12.5, 'description' => 'IOF',
        ])->assertStatus(201);

        $auditoria = $this->resumoDaApi($fatura)['auditoria'];
        $this->assertSame('CONFERE', $auditoria['status']);
        $this->assertTrue($auditoria['alterada_depois']);

        $this->getJson("/api/faturas/{$fatura->id}/auditorias")->assertOk()->assertJsonCount(1, 'data');
    }

    #[Test]
    public function nao_acessa_fatura_de_outro_usuario(): void
    {
        $this->comprar(100);
        $fatura = $this->fatura();

        Sanctum::actingAs(Conta::factory()->create()->user);

        $this->postJson("/api/faturas/{$fatura->id}/lancamentos", ['type' => 'EXPENSE', 'amount' => 1, 'description' => 'x'])
            ->assertStatus(403);
        $this->postJson("/api/faturas/{$fatura->id}/auditorias", ['bank_total' => 1])->assertStatus(403);
        $this->getJson("/api/faturas/{$fatura->id}/auditorias")->assertStatus(403);
    }
}
