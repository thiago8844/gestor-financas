<?php

namespace Tests\Feature;

use App\Actions\GerarTransacoesRecorrentes;
use App\Models\Cartao;
use App\Models\Categoria;
use App\Models\Conta;
use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class CategoriaRecorrenciaTest extends TestCase
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

    private function payload(array $extra = []): array
    {
        return array_merge([
            'type' => 'EXPENSE',
            'description' => 'Academia',
            'amount' => 150,
            'default_status' => 'PENDING',
            'frequency' => 'MONTHLY',
            'interval' => 1,
            'day_of_month' => 10,
            'start_date' => '2026-10-10',
        ], $extra);
    }

    #[Test]
    public function salva_a_categoria_escolhida_ao_criar_a_recorrencia(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $categoria = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Saúde']);

        // O front manda o id como string (vem de um input/select).
        $this->postJson('/api/recorrencias/criar', $this->payload([
            'account_id' => $conta->id, 'category_id' => (string) $categoria->id,
        ]))->assertStatus(201)->assertJsonPath('data.category_id', $categoria->id);

        $this->assertDatabaseHas('recurring_transactions', ['description' => 'Academia', 'category_id' => $categoria->id]);
    }

    #[Test]
    public function cria_a_categoria_pelo_nome_quando_ela_nao_existe(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->postJson('/api/recorrencias/criar', $this->payload([
            'account_id' => $conta->id, 'category_id' => null, 'category_name' => 'Lazer',
        ]))->assertStatus(201);

        $this->assertDatabaseHas('categories', ['user_id' => $conta->user_id, 'name' => 'Lazer']);
        $recorrencia = RecorrenciaTransacao::first();
        $this->assertNotNull($recorrencia->category_id);
    }

    #[Test]
    public function recusa_categoria_de_outro_usuario(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $deOutro = Categoria::create(['user_id' => Conta::factory()->create()->user_id, 'name' => 'Alheia']);

        $this->postJson('/api/recorrencias/criar', $this->payload([
            'account_id' => $conta->id, 'category_id' => (string) $deOutro->id,
        ]))->assertStatus(422)->assertJsonValidationErrors('category_id');
    }

    #[Test]
    public function edicao_mostra_e_atualiza_a_categoria(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $saude = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Saúde']);
        $lazer = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Lazer']);

        $id = $this->postJson('/api/recorrencias/criar', $this->payload([
            'account_id' => $conta->id, 'category_id' => $saude->id,
        ]))->json('data.id');

        // A edição precisa receber a categoria de volta no show.
        $this->getJson("/api/recorrencias/{$id}")->assertJsonPath('data.categoria.name', 'Saúde');

        $this->putJson("/api/recorrencias/atualizar/{$id}", $this->payload([
            'account_id' => $conta->id, 'category_id' => (string) $lazer->id,
        ]))->assertOk();
        $this->assertEquals($lazer->id, RecorrenciaTransacao::find($id)->category_id);

        // Limpar a categoria na edição zera o vínculo.
        $this->putJson("/api/recorrencias/atualizar/{$id}", $this->payload([
            'account_id' => $conta->id, 'category_id' => null, 'category_name' => '',
        ]))->assertOk();
        $this->assertNull(RecorrenciaTransacao::find($id)->category_id);
    }

    #[Test]
    public function a_ocorrencia_gerada_na_conta_leva_a_categoria(): void
    {
        $conta = Conta::factory()->create();
        $categoria = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Saúde']);

        $recorrencia = \App\Actions\CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE',
            'description' => 'Academia', 'amount' => 150, 'frequency' => 'MONTHLY', 'interval' => 1,
            'day_of_month' => 10, 'start_date' => '2026-10-10', 'category_id' => $categoria->id,
        ]);

        app(GerarTransacoesRecorrentes::class)->executar(Carbon::today());

        $this->assertEquals($categoria->id, Transacao::where('recurring_transaction_id', $recorrencia->id)->firstOrFail()->category_id);
    }

    #[Test]
    public function a_ocorrencia_gerada_no_cartao_leva_a_categoria(): void
    {
        $conta = Conta::factory()->create();
        $cartao = Cartao::create(['user_id' => $conta->user_id, 'account_id' => $conta->id, 'name' => 'Nubank', 'closing_day' => 5, 'due_day' => 20, 'active' => true]);
        $categoria = Categoria::create(['user_id' => $conta->user_id, 'name' => 'Assinaturas']);

        $recorrencia = \App\Actions\CriarRecorrenciaTransacao::executar($conta->user_id, [
            'card_id' => $cartao->id, 'type' => 'EXPENSE', 'description' => 'Netflix', 'amount' => 55.9,
            'frequency' => 'MONTHLY', 'interval' => 1, 'day_of_month' => 10, 'start_date' => '2026-10-10',
            'category_id' => $categoria->id,
        ]);

        app(GerarTransacoesRecorrentes::class)->executar(Carbon::today());

        $this->assertEquals($categoria->id, Transacao::where('recurring_transaction_id', $recorrencia->id)->firstOrFail()->category_id);
    }
}
