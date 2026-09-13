<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RelatorioResultadoFinanceiroTest extends TestCase
{
    use RefreshDatabase;

    private function criarTransacao(Conta $conta, array $overrides = []): Transacao
    {
        return Transacao::create(array_merge([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => 'EXPENSE',
            'amount' => 100,
            'status' => 'PAID',
            'date' => '2026-06-10',
            'due_date' => '2026-06-10',
        ], $overrides));
    }

    #[Test]
    public function resumo_calcula_receitas_despesas_resultado_e_margem(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 12500, 'date' => '2026-06-05', 'due_date' => '2026-06-05']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 9300, 'date' => '2026-06-10', 'due_date' => '2026-06-10']);

        $response = $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id,
        ]));

        $response->assertStatus(200);
        $response->assertJsonPath('data.resumo.receitas', 12500);
        $response->assertJsonPath('data.resumo.despesas', 9300);
        $response->assertJsonPath('data.resumo.resultado', 3200);
        $response->assertJsonPath('data.resumo.margem', 25.6);
    }

    #[Test]
    public function agrupa_despesas_por_categoria_com_percentual_e_embute_transacoes(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $moradia = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Moradia']);
        $alimentacao = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Alimentação']);

        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 2500, 'category_id' => $moradia->id, 'description' => 'Aluguel', 'date' => '2026-06-05', 'due_date' => '2026-06-05']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 600, 'category_id' => $moradia->id, 'description' => 'Energia', 'date' => '2026-06-06', 'due_date' => '2026-06-06']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 900, 'category_id' => $alimentacao->id, 'description' => 'Mercado', 'date' => '2026-06-07', 'due_date' => '2026-06-07']);

        $response = $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id,
        ]));

        $response->assertStatus(200);
        $despesas = $response->json('data.despesas');

        $linhaMoradia = collect($despesas)->firstWhere('categoria', 'Moradia');
        $this->assertEquals(3100, $linhaMoradia['total']);
        $this->assertEquals(77.5, $linhaMoradia['percentual']); // 3100 / 4000
        $this->assertCount(2, $linhaMoradia['transacoes']);

        $linhaAlimentacao = collect($despesas)->firstWhere('categoria', 'Alimentação');
        $this->assertEquals(900, $linhaAlimentacao['total']);
    }

    #[Test]
    public function transacoes_sem_categoria_ficam_agrupadas_como_sem_categoria(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 50, 'category_id' => null]);

        $response = $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id,
        ]));

        $despesas = $response->json('data.despesas');
        $this->assertSame('Sem categoria', $despesas[0]['categoria']);
        $this->assertNull($despesas[0]['categoria_id']);
    }

    #[Test]
    public function compara_categoria_com_periodo_anterior(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $moradia = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Moradia']);

        // Período anterior (maio): 3.050 em Moradia
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 3050, 'category_id' => $moradia->id, 'date' => '2026-05-15', 'due_date' => '2026-05-15']);

        // Período atual (junho): 3.100 em Moradia
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 3100, 'category_id' => $moradia->id, 'date' => '2026-06-15', 'due_date' => '2026-06-15']);

        $response = $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id, 'comparar_com' => 'PERIODO_ANTERIOR',
        ]));

        $despesas = $response->json('data.despesas');
        $linhaMoradia = collect($despesas)->firstWhere('categoria', 'Moradia');

        $this->assertEquals(3100, $linhaMoradia['total']);
        $this->assertEquals(3050, $linhaMoradia['periodo_anterior']);
        $this->assertEquals(1.6, $linhaMoradia['variacao_percentual']);
    }

    #[Test]
    public function serie_mensal_agrupa_receitas_e_despesas_por_mes(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 1000, 'date' => '2026-06-05', 'due_date' => '2026-06-05']);
        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 2000, 'date' => '2026-07-05', 'due_date' => '2026-07-05']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 300, 'date' => '2026-07-10', 'due_date' => '2026-07-10']);

        $response = $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-07-31', 'conta_id' => $conta->id,
        ]));

        $serie = $response->json('data.serie_mensal');
        $this->assertCount(2, $serie);
        $this->assertEquals(['periodo' => '2026-06-01', 'receitas' => 1000, 'despesas' => 0], $serie[0]);
        $this->assertEquals(['periodo' => '2026-07-01', 'receitas' => 2000, 'despesas' => 300], $serie[1]);
    }

    #[Test]
    public function exige_data_inicial_e_data_final(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->getJson('/api/relatorios/resultado-financeiro');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['data_inicial', 'data_final']);
    }
}
