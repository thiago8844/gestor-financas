<?php

namespace Tests\Feature;

use App\Models\Cartao;
use App\Models\Conta;
use App\Models\Fatura;
use App\Models\Orcamento;
use App\Queries\SaldoContaQuery;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Estorno no cartão e pagamento parcial (rolagem) não podem bagunçar os relatórios:
 *  - consumo (resultado, análise de gastos): cada compra conta uma vez, pelo valor cheio;
 *    a rolagem não é gasto;
 *  - caixa (fluxo de caixa, despesas futuras): o mês mostra o que saiu da conta de verdade.
 *
 * Cenário: fatura de agosto com compras de 600 + 400 e estorno de 100 (total 900). Pago 300 em
 * 20/08; 600 rolam para setembro, que ainda tem uma compra de 50 (total 650, pago em 20/09).
 * Saiu da conta: 300 em agosto e 650 em setembro. Gasto: 1000 + 50.
 */
class RelatoriosComFaturaTest extends TestCase
{
    use RefreshDatabase;

    private Conta $conta;
    private Cartao $cartao;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-08-25');

        $this->conta = Conta::factory()->create();
        Sanctum::actingAs($this->conta->user);

        $this->cartao = Cartao::create([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);

        $this->comprar(600, '2026-08-05');
        $this->comprar(400, '2026-08-05');
        $this->comprar(100, '2026-08-06', ['type' => 'INCOME', 'description' => 'Estorno']);
        $this->comprar(50, '2026-09-05');

        $this->postJson("/api/faturas/{$this->fatura('2026-08-01')->id}/pagar", ['date' => '2026-08-20', 'amount' => 300])
            ->assertOk()
            ->assertJsonPath('data.levado_para_proxima', 600);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function comprar(float $valor, string $data, array $extra = []): void
    {
        $this->postJson('/api/transacoes/cartao', array_merge([
            'card_id' => $this->cartao->id, 'description' => 'Compra', 'amount' => $valor, 'purchase_date' => $data,
        ], $extra))->assertStatus(201);
    }

    private function fatura(string $mes): Fatura
    {
        return Fatura::where('card_id', $this->cartao->id)->whereDate('reference_month', $mes)->firstOrFail();
    }

    private function pagarSetembro(): void
    {
        Carbon::setTestNow('2026-09-25');
        $this->postJson("/api/faturas/{$this->fatura('2026-09-01')->id}/pagar", ['date' => '2026-09-20'])->assertOk();
    }

    #[Test]
    public function despesas_futuras_nao_conta_o_saldo_rolado_duas_vezes(): void
    {
        $r = $this->getJson('/api/dashboard/despesas-futuras?data_final=2026-12-31')->assertOk();

        // Agosto: saíram 300 (1000 - 100 de estorno - 600 levados). Setembro: 600 rolados + 50 a pagar.
        $r->assertJsonPath('pago', 300);
        $r->assertJsonPath('a_pagar', 650);
        $r->assertJsonPath('total', 950);

        $this->pagarSetembro();

        $this->getJson('/api/dashboard/despesas-futuras?data_final=2026-12-31')
            ->assertOk()
            ->assertJsonPath('pago', 650)
            ->assertJsonPath('a_pagar', 0);
    }

    #[Test]
    public function fluxo_de_caixa_mostra_o_que_saiu_da_conta_em_cada_mes(): void
    {
        $this->pagarSetembro();

        $agosto = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-08-01', 'data_final' => '2026-08-31', 'conta_ids' => [$this->conta->id],
        ]))->assertOk();

        // O crédito da rolagem abate da saída (não vira entrada); o estorno entra como receita.
        $agosto->assertJsonPath('data.resumo.entradas', 100);
        $agosto->assertJsonPath('data.resumo.saidas', 400);
        $agosto->assertJsonPath('data.resumo.resultado_liquido', -300);

        $setembro = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-09-01', 'data_final' => '2026-09-30', 'conta_ids' => [$this->conta->id],
        ]))->assertOk();

        $setembro->assertJsonPath('data.resumo.entradas', 0);
        $setembro->assertJsonPath('data.resumo.saidas', 650);
        $setembro->assertJsonPath('data.resumo.saldo_final', -950);

        // Filtrando só saídas, a série de agosto também mostra o líquido do que saiu.
        $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-08-01', 'data_final' => '2026-08-31', 'conta_ids' => [$this->conta->id],
            'type' => 'EXPENSE', 'agrupamento' => 'MONTHLY',
        ]))->assertOk()->assertJsonPath('data.serie.0.saidas', 400);

        $this->assertSame(-950.0, SaldoContaQuery::calcularSaldo($this->conta->id));
    }

    #[Test]
    public function relatorios_de_consumo_contam_cada_compra_uma_vez_e_ignoram_a_rolagem(): void
    {
        $this->pagarSetembro();

        $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => '2026-09-01', 'data_final' => '2026-09-30', 'conta_ids' => [$this->conta->id],
        ]))->assertOk()
            ->assertJsonPath('data.resumo.despesas', 50)
            ->assertJsonPath('data.resumo.receitas', 0);

        $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => '2026-08-01', 'data_final' => '2026-08-31', 'conta_ids' => [$this->conta->id],
        ]))->assertOk()
            ->assertJsonPath('data.resumo.despesas', 1000)
            ->assertJsonPath('data.resumo.receitas', 100);

        $this->getJson('/api/relatorios/analise-gastos?' . http_build_query([
            'data_inicial' => '2026-08-01', 'data_final' => '2026-09-30',
        ]))->assertOk()->assertJsonPath('data.resumo.total', 1050);
    }

    #[Test]
    public function credito_no_cartao_nao_entra_em_orcamento(): void
    {
        $orcamento = Orcamento::create([
            'user_id' => $this->conta->user_id, 'name' => 'Mercado', 'type' => 'RECURRING',
            'frequency' => 'MONTHLY', 'interval' => 1, 'start_date' => '2026-08-01',
        ]);

        $this->comprar(30, '2026-08-07', ['type' => 'INCOME', 'description' => 'Estorno 2', 'budget_id' => $orcamento->id]);

        $this->assertDatabaseHas('transactions', ['description' => 'Estorno 2', 'budget_id' => null]);
    }
}
