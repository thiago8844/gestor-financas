<?php

namespace Tests\Feature;

use App\Actions\Notificacoes\GerarNotificacoes;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\Notificacao;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NotificacaoTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function comando_cria_notificacao_para_transacao_com_fatura_vencida(): void
    {
        $conta = Conta::factory()->create();

        $transacao = Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Conta de luz',
            'amount' => 150,
            'status' => TransactionStatus::PENDING,
            'due_date' => now()->subDays(3),
        ]);

        $criadas = (new GerarNotificacoes())->executar();

        $this->assertEquals(1, $criadas);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $conta->user_id,
            'type' => 'fatura_vencida',
            'dedupe_key' => "fatura_vencida:transacao:{$transacao->id}",
        ]);
    }

    #[Test]
    public function comando_nao_duplica_notificacao_ja_existente_ao_rodar_de_novo(): void
    {
        $conta = Conta::factory()->create();

        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Conta de luz',
            'amount' => 150,
            'status' => TransactionStatus::PENDING,
            'due_date' => now()->subDays(3),
        ]);

        (new GerarNotificacoes())->executar();
        $segundaExecucao = (new GerarNotificacoes())->executar();

        $this->assertEquals(0, $segundaExecucao);
        $this->assertEquals(1, Notificacao::count());
    }

    #[Test]
    public function nao_notifica_transacao_paga_ou_ainda_no_prazo(): void
    {
        $conta = Conta::factory()->create();

        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Já paga',
            'amount' => 150,
            'status' => TransactionStatus::PAID,
            'date' => now(),
            'due_date' => now()->subDays(3),
        ]);

        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Vence no futuro',
            'amount' => 150,
            'status' => TransactionStatus::PENDING,
            'due_date' => now()->addDays(3),
        ]);

        $criadas = (new GerarNotificacoes())->executar();

        $this->assertEquals(0, $criadas);
    }

    #[Test]
    public function lista_apenas_notificacoes_do_usuario_autenticado(): void
    {
        $conta = Conta::factory()->create();
        $outraConta = Conta::factory()->create();

        Notificacao::create([
            'user_id' => $conta->user_id,
            'type' => 'fatura_vencida',
            'title' => 'Minha notificação',
            'message' => 'Mensagem',
            'dedupe_key' => 'fatura_vencida:transacao:1',
        ]);

        Notificacao::create([
            'user_id' => $outraConta->user_id,
            'type' => 'fatura_vencida',
            'title' => 'Notificação de outro usuário',
            'message' => 'Mensagem',
            'dedupe_key' => 'fatura_vencida:transacao:2',
        ]);

        Sanctum::actingAs($conta->user);

        $response = $this->getJson('/api/notificacoes');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.title', 'Minha notificação');
    }

    #[Test]
    public function marca_notificacao_como_lida_apenas_do_dono(): void
    {
        $conta = Conta::factory()->create();
        $outraConta = Conta::factory()->create();

        $notificacao = Notificacao::create([
            'user_id' => $conta->user_id,
            'type' => 'fatura_vencida',
            'title' => 'Minha notificação',
            'message' => 'Mensagem',
            'dedupe_key' => 'fatura_vencida:transacao:1',
        ]);

        Sanctum::actingAs($outraConta->user);
        $this->patchJson("/api/notificacoes/{$notificacao->id}/marcar-lida")
            ->assertStatus(403);

        Sanctum::actingAs($conta->user);
        $this->patchJson("/api/notificacoes/{$notificacao->id}/marcar-lida")
            ->assertStatus(200);

        $this->assertNotNull($notificacao->fresh()->read_at);
    }

    #[Test]
    public function marca_todas_como_lidas(): void
    {
        $conta = Conta::factory()->create();

        Notificacao::create([
            'user_id' => $conta->user_id,
            'type' => 'fatura_vencida',
            'title' => 'Uma',
            'message' => 'Mensagem',
            'dedupe_key' => 'fatura_vencida:transacao:1',
        ]);

        Notificacao::create([
            'user_id' => $conta->user_id,
            'type' => 'fatura_vencida',
            'title' => 'Duas',
            'message' => 'Mensagem',
            'dedupe_key' => 'fatura_vencida:transacao:2',
        ]);

        Sanctum::actingAs($conta->user);

        $this->patchJson('/api/notificacoes/marcar-todas-lidas')->assertStatus(200);

        $this->assertEquals(0, Notificacao::where('user_id', $conta->user_id)->naoLidas()->count());
    }
}
