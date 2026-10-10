<?php

namespace Tests\Feature;

use App\Actions\CriarRecorrenciaTransacao;
use App\Actions\GerarTransacoesRecorrentes;
use App\Models\Cartao;
use App\Models\Conta;
use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class VincularLancamentosRecorrenciaTest extends TestCase
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

    private function lancamento(Conta $conta, array $extra = []): Transacao
    {
        return Transacao::create(array_merge([
            'user_id' => $conta->user_id, 'account_id' => $conta->id, 'type' => 'INCOME',
            'amount' => 4000, 'status' => 'PAID', 'date' => '2026-09-05', 'due_date' => '2026-09-05',
            'description' => 'Salário',
        ], $extra));
    }

    private function salario(Conta $conta, array $extra = []): RecorrenciaTransacao
    {
        return CriarRecorrenciaTransacao::executar($conta->user_id, array_merge([
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'INCOME',
            'description' => 'Salário', 'amount' => null, 'frequency' => 'MONTHLY', 'interval' => 1,
            'day_of_month' => 5, 'start_date' => '2026-10-05',
        ], $extra));
    }

    #[Test]
    public function lista_apenas_lancamentos_passados_avulsos_do_mesmo_tipo(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $recorrencia = $this->salario($conta);

        $elegivel = $this->lancamento($conta, ['date' => '2026-09-05', 'due_date' => '2026-09-05']);
        $this->lancamento($conta, ['date' => '2026-12-05', 'due_date' => '2026-12-05']); // futuro
        $this->lancamento($conta, ['type' => 'EXPENSE', 'description' => 'Mercado']); // tipo errado
        $this->lancamento($conta, ['is_initial_balance' => true, 'description' => 'Saldo']);
        $this->lancamento($conta, ['recurring_transaction_id' => $recorrencia->id]); // já vinculado

        $resposta = $this->getJson("/api/recorrencias/{$recorrencia->id}/lancamentos-candidatos")->assertOk();

        $this->assertCount(1, $resposta->json('data'));
        $this->assertEquals($elegivel->id, $resposta->json('data.0.id'));
    }

    #[Test]
    public function vincula_lancamentos_e_recorrencia_passa_a_contar_como_historico(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $recorrencia = $this->salario($conta);

        $ids = [
            $this->lancamento($conta, ['amount' => 4000, 'date' => '2026-07-05', 'due_date' => '2026-07-05'])->id,
            $this->lancamento($conta, ['amount' => 4300, 'date' => '2026-08-05', 'due_date' => '2026-08-05'])->id,
            $this->lancamento($conta, ['amount' => 4100, 'date' => '2026-09-05', 'due_date' => '2026-09-05'])->id,
        ];

        $this->postJson("/api/recorrencias/{$recorrencia->id}/lancamentos", ['transacao_ids' => $ids])
            ->assertOk()
            ->assertJsonPath('message', '3 lançamento(s) vinculado(s) à recorrência');

        $this->assertEquals(3, Transacao::where('recurring_transaction_id', $recorrencia->id)->count());
        // Última vinculada é 05/09, antes da próxima geração (05/10): a próxima não muda.
        $this->assertEquals('2026-10-05', $recorrencia->fresh()->next_run_date->toDateString());
    }

    #[Test]
    public function avanca_a_proxima_geracao_para_nao_duplicar_o_que_ja_foi_lancado(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $recorrencia = $this->salario($conta); // próxima: 05/10

        // Salário de outubro caiu dia 06, já lançado manualmente.
        $id = $this->lancamento($conta, ['date' => '2026-10-06', 'due_date' => '2026-10-06'])->id;

        // Recebido em 06/10 mas data de hoje é 10/10: a candidata existe (passada).
        $this->postJson("/api/recorrencias/{$recorrencia->id}/lancamentos", ['transacao_ids' => [$id]])->assertOk();

        $this->assertEquals('2026-11-05', $recorrencia->fresh()->next_run_date->toDateString());

        // Gerar hoje não cria a cópia de outubro.
        app(GerarTransacoesRecorrentes::class)->executar(Carbon::today());
        $this->assertEquals(1, Transacao::where('recurring_transaction_id', $recorrencia->id)->count());
    }

    #[Test]
    public function recusa_lancamento_de_outro_usuario_ou_ja_vinculado(): void
    {
        $conta = Conta::factory()->create();
        $outra = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $recorrencia = $this->salario($conta);

        $deOutro = $this->lancamento($outra);
        $this->postJson("/api/recorrencias/{$recorrencia->id}/lancamentos", ['transacao_ids' => [$deOutro->id]])
            ->assertStatus(422);

        $outraRecorrencia = $this->salario($conta, ['description' => 'Outro']);
        $jaVinculado = $this->lancamento($conta, ['recurring_transaction_id' => $outraRecorrencia->id]);
        $this->postJson("/api/recorrencias/{$recorrencia->id}/lancamentos", ['transacao_ids' => [$jaVinculado->id]])
            ->assertStatus(422);

        $futuro = $this->lancamento($conta, ['date' => '2026-12-01', 'due_date' => '2026-12-01']);
        $this->postJson("/api/recorrencias/{$recorrencia->id}/lancamentos", ['transacao_ids' => [$futuro->id]])
            ->assertStatus(422);

        $this->assertNull($deOutro->fresh()->recurring_transaction_id);
    }

    #[Test]
    public function nao_acessa_recorrencia_de_outro_usuario(): void
    {
        $dono = Conta::factory()->create();
        $recorrencia = $this->salario($dono);

        $intruso = Conta::factory()->create();
        Sanctum::actingAs($intruso->user);

        $this->getJson("/api/recorrencias/{$recorrencia->id}/lancamentos-candidatos")->assertStatus(403);
        $this->postJson("/api/recorrencias/{$recorrencia->id}/lancamentos", ['transacao_ids' => [1]])->assertStatus(403);
    }

    #[Test]
    public function recorrencia_de_cartao_so_recebe_compras_do_mesmo_cartao(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = Cartao::create(['user_id' => $conta->user_id, 'account_id' => $conta->id, 'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true]);
        $outroCartao = Cartao::create(['user_id' => $conta->user_id, 'account_id' => $conta->id, 'name' => 'Inter', 'closing_day' => 10, 'due_day' => 20, 'active' => true]);

        $recorrencia = $this->salario($conta, [
            'type' => 'EXPENSE', 'description' => 'Netflix', 'amount' => 55.9, 'card_id' => $cartao->id,
        ]);

        $doCartao = $this->lancamento($conta, ['type' => 'EXPENSE', 'card_id' => $cartao->id, 'amount' => 55.9, 'status' => 'PENDING', 'date' => null, 'due_date' => '2026-09-20', 'purchase_date' => '2026-09-12']);
        $deOutro = $this->lancamento($conta, ['type' => 'EXPENSE', 'card_id' => $outroCartao->id, 'amount' => 55.9, 'status' => 'PENDING', 'date' => null, 'due_date' => '2026-09-20', 'purchase_date' => '2026-09-12']);

        $ids = collect($this->getJson("/api/recorrencias/{$recorrencia->id}/lancamentos-candidatos")->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($doCartao->id));
        $this->assertFalse($ids->contains($deOutro->id));
    }

    #[Test]
    public function lista_os_lancamentos_ja_vinculados(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $recorrencia = $this->salario($conta);
        $this->lancamento($conta, ['recurring_transaction_id' => $recorrencia->id, 'description' => 'Salário set']);
        $this->lancamento($conta, ['description' => 'Solto']);

        $resposta = $this->getJson("/api/recorrencias/{$recorrencia->id}/lancamentos")->assertOk();

        $this->assertCount(1, $resposta->json('data'));
        $resposta->assertJsonPath('data.0.description', 'Salário set');
    }

    #[Test]
    public function desvincular_remove_so_o_vinculo(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $recorrencia = $this->salario($conta);
        $lancamento = $this->lancamento($conta, ['recurring_transaction_id' => $recorrencia->id]);

        $this->deleteJson("/api/recorrencias/{$recorrencia->id}/lancamentos/{$lancamento->id}")->assertOk();

        $this->assertNull($lancamento->fresh()->recurring_transaction_id);
        $this->assertDatabaseHas('transactions', ['id' => $lancamento->id]);
    }
}
