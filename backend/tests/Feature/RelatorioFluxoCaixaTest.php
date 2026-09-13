<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RelatorioFluxoCaixaTest extends TestCase
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
    public function resumo_calcula_saldo_inicial_entradas_saidas_e_saldo_final(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        // Antes do período (compõe o saldo de abertura): +1000 -200 = 800
        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 1000, 'date' => '2026-05-15', 'due_date' => '2026-05-15']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 200, 'date' => '2026-05-20', 'due_date' => '2026-05-20']);

        // Dentro do período
        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 500, 'date' => '2026-06-05', 'due_date' => '2026-06-05']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 150, 'date' => '2026-06-10', 'due_date' => '2026-06-10']);

        $response = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01',
            'data_final' => '2026-06-30',
            'conta_id' => $conta->id,
        ]));

        $response->assertStatus(200);
        $response->assertJsonPath('data.resumo.saldo_inicial', 800);
        $response->assertJsonPath('data.resumo.entradas', 500);
        $response->assertJsonPath('data.resumo.saidas', 150);
        $response->assertJsonPath('data.resumo.resultado_liquido', 350);
        $response->assertJsonPath('data.resumo.saldo_final', 1150);
    }

    #[Test]
    public function regime_de_caixa_ignora_transacoes_pendentes_e_competencia_as_inclui(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->criarTransacao($conta, [
            'type' => 'EXPENSE', 'amount' => 999, 'status' => 'PENDING',
            'date' => null, 'due_date' => '2026-06-15',
        ]);

        $caixa = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id, 'regime' => 'CAIXA',
        ]));
        $caixa->assertJsonPath('data.resumo.saidas', 0);

        $competencia = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id, 'regime' => 'COMPETENCIA',
        ]));
        $competencia->assertJsonPath('data.resumo.saidas', 999);
    }

    #[Test]
    public function serie_agrupa_por_dia_e_embute_os_lancamentos_do_bucket(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 500, 'description' => 'Salário', 'date' => '2026-06-05', 'due_date' => '2026-06-05']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 150, 'description' => 'Mercado', 'date' => '2026-06-05', 'due_date' => '2026-06-05']);

        $response = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id, 'agrupamento' => 'DAILY',
        ]));

        $response->assertStatus(200);
        $serie = $response->json('data.serie');
        $bucket = collect($serie)->firstWhere('periodo', '2026-06-05');

        $this->assertNotNull($bucket);
        $this->assertEquals(500, $bucket['entradas']);
        $this->assertEquals(150, $bucket['saidas']);
        $this->assertCount(2, $bucket['transacoes']);
        $this->assertEqualsCanonicalizing(
            ['Salário', 'Mercado'],
            array_column($bucket['transacoes'], 'description')
        );
    }

    #[Test]
    public function serie_agrupa_por_semana_e_por_mes_sem_depender_de_funcoes_especificas_do_mysql(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        // 2026-06-01 é segunda-feira; 2026-06-08 é a segunda seguinte (semanas distintas).
        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 500, 'date' => '2026-06-01', 'due_date' => '2026-06-01']);
        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 700, 'date' => '2026-06-08', 'due_date' => '2026-06-08']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 100, 'date' => '2026-07-03', 'due_date' => '2026-07-03']);

        $semanal = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-07-31', 'conta_id' => $conta->id, 'agrupamento' => 'WEEKLY',
        ]));
        $semanal->assertStatus(200);
        $serieSemanal = $semanal->json('data.serie');
        $this->assertEquals('2026-06-01', $serieSemanal[0]['periodo']);
        $this->assertEquals(500, $serieSemanal[0]['entradas']);
        $this->assertEquals('2026-06-08', $serieSemanal[1]['periodo']);
        $this->assertEquals(700, $serieSemanal[1]['entradas']);

        $mensal = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-07-31', 'conta_id' => $conta->id, 'agrupamento' => 'MONTHLY',
        ]));
        $mensal->assertStatus(200);
        $serieMensal = $mensal->json('data.serie');
        $this->assertEquals('2026-06-01', $serieMensal[0]['periodo']);
        $this->assertEquals(1200, $serieMensal[0]['entradas']);
        $this->assertEquals(1200, $serieMensal[0]['saldo_acumulado']);
        $this->assertEquals('2026-07-01', $serieMensal[1]['periodo']);
        $this->assertEquals(100, $serieMensal[1]['saidas']);
        $this->assertEquals(1100, $serieMensal[1]['saldo_acumulado']);
    }

    #[Test]
    public function filtros_secundarios_nao_afetam_o_resumo_mas_afetam_serie_e_lancamentos(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $alimentacao = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Alimentação']);
        $transporte = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Transporte']);

        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 100, 'category_id' => $alimentacao->id, 'date' => '2026-06-05', 'due_date' => '2026-06-05']);
        $this->criarTransacao($conta, ['type' => 'EXPENSE', 'amount' => 300, 'category_id' => $transporte->id, 'date' => '2026-06-06', 'due_date' => '2026-06-06']);

        $response = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id, 'category_id' => $alimentacao->id,
        ]));

        $response->assertStatus(200);
        // Resumo reflete o saldo REAL da conta (as duas despesas), não o filtro de categoria.
        $response->assertJsonPath('data.resumo.saidas', 400);

        // Lançamentos e série só trazem a categoria filtrada.
        $lancamentos = $response->json('data.lancamentos');
        $this->assertCount(1, $lancamentos);
        $this->assertEquals(100, $lancamentos[0]['amount']);
    }

    #[Test]
    public function comparar_com_periodo_anterior_calcula_variacao_percentual(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        // Maio (período anterior de 30 dias antes de 01/06-30/06): resultado líquido = 100
        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 100, 'date' => '2026-05-15', 'due_date' => '2026-05-15']);

        // Junho (período atual): resultado líquido = 200
        $this->criarTransacao($conta, ['type' => 'INCOME', 'amount' => 200, 'date' => '2026-06-15', 'due_date' => '2026-06-15']);

        $response = $this->getJson('/api/relatorios/fluxo-de-caixa?' . http_build_query([
            'data_inicial' => '2026-06-01', 'data_final' => '2026-06-30', 'conta_id' => $conta->id, 'comparar_com' => 'PERIODO_ANTERIOR',
        ]));

        $response->assertStatus(200);
        $response->assertJsonPath('data.resumo.resultado_liquido', 200);
        $response->assertJsonPath('data.resumo.comparacao.resultado_liquido', 100);
        $response->assertJsonPath('data.resumo.comparacao.variacao_percentual', 100);
    }

    #[Test]
    public function exige_data_inicial_e_data_final(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->getJson('/api/relatorios/fluxo-de-caixa');

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['data_inicial', 'data_final']);
    }
}
