<?php

namespace Tests\Feature;

use App\Models\Categoria;
use App\Models\Conta;
use App\Models\OfxImportRule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RegraImportacaoOfxTest extends TestCase
{
    use RefreshDatabase;

    private function arquivoFake(string $fixture): UploadedFile
    {
        $conteudo = file_get_contents(base_path('tests/Fixtures/Ofx/' . $fixture));

        return UploadedFile::fake()->createWithContent('extrato.ofx', $conteudo);
    }

    #[Test]
    public function criar_regra_a_partir_de_uma_edicao(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $categoria = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Alimentação']);

        $response = $this->postJson('/api/regras-importacao-ofx/criar', [
            'descricao_contains' => 'JOAO FERREIRA',
            'tipo' => 'EXPENSE',
            'descricao' => 'Frutas na feira',
            'category_id' => $categoria->id,
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('ofx_import_rules', [
            'user_id' => $conta->user_id,
            'active' => true,
        ]);

        $regra = OfxImportRule::first();
        $this->assertSame('JOAO FERREIRA', $regra->conditions['descricao_contains']);
        $this->assertSame('Frutas na feira', $regra->actions['descricao']);
        $this->assertSame($categoria->id, $regra->actions['category_id']);
    }

    #[Test]
    public function aplicar_ao_lote_no_momento_da_criacao_afeta_outras_linhas_pendentes_da_mesma_importacao(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $categoria = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Alimentação']);

        $upload = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
        ]);
        $importacaoId = $upload->json('data.id');

        $response = $this->postJson('/api/regras-importacao-ofx/criar', [
            'descricao_contains' => 'JOAO FERREIRA',
            'tipo' => 'EXPENSE',
            'descricao' => 'Frutas na feira',
            'category_id' => $categoria->id,
            'ofx_import_id' => $importacaoId,
            'aplicar_ao_lote' => true,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('itens_aplicados', 1);

        $this->assertDatabaseHas('ofx_import_items', [
            'ofx_import_id' => $importacaoId,
            'fitid' => '2026080500001',
            'descricao' => 'Frutas na feira',
            'category_id' => $categoria->id,
        ]);

        // O item de salário (tipo INCOME) não deve ter sido afetado pela regra (condição tipo=EXPENSE).
        $this->assertDatabaseHas('ofx_import_items', [
            'ofx_import_id' => $importacaoId,
            'fitid' => '2026081000002',
            'descricao' => 'SALARIO EMPRESA XYZ',
        ]);
    }

    #[Test]
    public function regra_ativa_e_aplicada_automaticamente_em_uma_importacao_nova(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $categoria = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Alimentação']);

        $this->postJson('/api/regras-importacao-ofx/criar', [
            'descricao_contains' => 'JOAO FERREIRA',
            'tipo' => 'EXPENSE',
            'descricao' => 'Frutas na feira',
            'category_id' => $categoria->id,
        ])->assertStatus(201);

        $upload = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
        ]);

        $upload->assertStatus(201);

        $regra = OfxImportRule::first();
        $this->assertSame(1, $regra->fresh()->vezes_aplicada);

        $this->assertDatabaseHas('ofx_import_items', [
            'fitid' => '2026080500001',
            'descricao' => 'Frutas na feira',
            'category_id' => $categoria->id,
            'regra_aplicada_id' => $regra->id,
        ]);
    }

    #[Test]
    public function alternar_ativo_e_deletar_regra(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $regra = OfxImportRule::create([
            'user_id' => $conta->user_id,
            'name' => 'Teste',
            'conditions' => ['descricao_contains' => 'UBER'],
            'actions' => ['descricao' => 'Uber'],
            'active' => true,
        ]);

        $this->patchJson("/api/regras-importacao-ofx/{$regra->id}/alternar-ativo")
            ->assertStatus(200)
            ->assertJsonPath('data.active', false);

        $this->deleteJson("/api/regras-importacao-ofx/deletar/{$regra->id}")->assertStatus(200);
        $this->assertDatabaseMissing('ofx_import_rules', ['id' => $regra->id]);
    }
}
