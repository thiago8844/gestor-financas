<?php

namespace Tests\Feature;

use App\Actions\Cartoes\CriarDespesaCartao;
use App\Actions\CriarRecorrenciaTransacao;
use App\Models\Cartao;
use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RelatorioAnaliseGastosTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-10 09:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function gasto(Conta $conta, array $overrides = []): Transacao
    {
        return Transacao::create(array_merge([
            'user_id' => $conta->user_id, 'account_id' => $conta->id, 'type' => 'EXPENSE',
            'amount' => 100, 'status' => 'PAID', 'date' => '2026-10-02', 'description' => 'Gasto',
        ], $overrides));
    }

    private function relatorio(array $params = []): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/relatorios/analise-gastos?' . http_build_query(array_merge([
            'data_inicial' => '2026-10-01', 'data_final' => '2026-12-31',
        ], $params)));
    }

    #[Test]
    public function divide_em_natureza_situacao_e_nao_conta_nada_duas_vezes(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $mercado = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Mercado']);

        $cartao = Cartao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);

        // Variável paga e variável pendente.
        $this->gasto($conta, ['amount' => 300, 'category_id' => $mercado->id, 'description' => 'Mercado']);
        $this->gasto($conta, ['amount' => 80, 'status' => 'PENDING', 'date' => null, 'due_date' => '2026-10-25', 'description' => 'Dentista']);
        // Variável no cartão (compra de 05/10).
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Mercado cartão', 'amount' => 200, 'purchase_date' => '2026-10-05', 'category_id' => $mercado->id,
        ]);
        // Parcelada: 1.200 em 4x, 05/10 → parcelas de 300 (3 delas até dezembro).
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Notebook', 'amount' => 1200, 'purchase_date' => '2026-10-05', 'installment_total' => 4,
        ]);
        // Fixa: aluguel 1.000 em 15/10, 15/11, 15/12 (ainda não lançados = previstos).
        CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE',
            'description' => 'Aluguel', 'amount' => 1000, 'frequency' => 'MONTHLY',
            'interval' => 1, 'day_of_month' => 15, 'start_date' => '2026-10-15',
        ]);
        // Transferência e receita nunca entram.
        $this->gasto($conta, ['amount' => 999, 'transfer_id' => null, 'type' => 'INCOME', 'description' => 'Salário']);

        $r = $this->relatorio(['base_data' => 'GASTO'])->assertOk();

        $porNatureza = collect($r->json('data.por_natureza'))->keyBy('natureza');

        $this->assertEquals(300 + 80 + 200, $porNatureza['VARIAVEL']['total']);
        $this->assertEquals(300, $porNatureza['VARIAVEL']['pago']);
        $this->assertEquals(280, $porNatureza['VARIAVEL']['pendente']);
        $this->assertEquals(200, $porNatureza['VARIAVEL']['no_cartao']);

        $this->assertEquals(3000, $porNatureza['FIXA']['total']);
        $this->assertEquals(3000, $porNatureza['FIXA']['previsto']);

        // Parcelas por data da compra: todas as 4 parcelas têm a compra de 05/10 como data do gasto.
        $this->assertEquals(1200, $porNatureza['PARCELADA']['total']);

        $r->assertJsonPath('data.resumo.total', 580 + 3000 + 1200);
        $r->assertJsonPath('data.resumo.pago', 300);
        $r->assertJsonPath('data.resumo.previsto', 3000);
        $r->assertJsonPath('data.resumo.fixos', 3000);

        // A soma das categorias e dos meios fecha com o total.
        $this->assertEquals(4780, array_sum(array_column($r->json('data.por_categoria'), 'total')));
        $this->assertEquals(4780, array_sum(array_column($r->json('data.por_meio'), 'total')));

        $mercadoLinha = collect($r->json('data.por_categoria'))->firstWhere('categoria', 'Mercado');
        $this->assertEquals(500, $mercadoLinha['total']);
        $this->assertEquals(200, $mercadoLinha['no_cartao']);

        $r->assertJsonCount(1, 'data.recorrencias');
        $r->assertJsonPath('data.recorrencias.0.ocorrencias', 3);
    }

    #[Test]
    public function recorrencia_ja_lancada_nao_e_prevista_de_novo(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $recorrencia = CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE',
            'description' => 'Internet', 'amount' => 100, 'frequency' => 'MONTHLY',
            'interval' => 1, 'day_of_month' => 10, 'start_date' => '2026-10-10',
        ]);

        (new \App\Actions\GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-10-10'));

        $r = $this->relatorio(['data_final' => '2026-11-30'])->assertOk();

        // Outubro: 1 lançada (pendente). Novembro: 1 prevista. Nunca 2 em outubro.
        $r->assertJsonPath('data.resumo.pendente', 100);
        $r->assertJsonPath('data.resumo.previsto', 100);
        $r->assertJsonPath('data.resumo.total', 200);
    }

    #[Test]
    public function recorrencia_sem_valor_e_fixa_variavel_e_fica_fora_dos_totais(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE',
            'description' => 'Luz', 'amount' => null, 'frequency' => 'MONTHLY',
            'interval' => 1, 'day_of_month' => 20, 'start_date' => '2026-10-20',
        ]);

        $r = $this->relatorio(['data_final' => '2026-10-31'])->assertOk();

        $r->assertJsonPath('data.resumo.total', 0);
        $r->assertJsonPath('data.resumo.sem_valor', 1);
        $this->assertSame('FIXA_VARIAVEL', $r->json('data.lancamentos.0.natureza'));
    }

    #[Test]
    public function base_pagamento_leva_compra_do_cartao_para_o_vencimento_da_fatura(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $cartao = Cartao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);
        // Compra em setembro, fatura vence 20/10.
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Compra', 'amount' => 400, 'purchase_date' => '2026-09-25',
        ]);

        $this->relatorio(['data_inicial' => '2026-10-01', 'data_final' => '2026-10-31', 'base_data' => 'GASTO'])
            ->assertJsonPath('data.resumo.total', 0);

        $this->relatorio(['data_inicial' => '2026-10-01', 'data_final' => '2026-10-31', 'base_data' => 'PAGAMENTO'])
            ->assertJsonPath('data.resumo.total', 400);
    }

    #[Test]
    public function compara_com_o_periodo_anterior(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->gasto($conta, ['amount' => 100, 'date' => '2026-09-10']);
        $this->gasto($conta, ['amount' => 150, 'date' => '2026-10-05']);

        $r = $this->relatorio(['data_inicial' => '2026-10-01', 'data_final' => '2026-10-31', 'comparar' => 1])->assertOk();

        $r->assertJsonPath('data.resumo.total', 150);
        $r->assertJsonPath('data.resumo.anterior', 100);
        $r->assertJsonPath('data.resumo.variacao_percentual', 50);
    }
}
