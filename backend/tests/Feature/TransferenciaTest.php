<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\Transacao;
use App\Models\Transferencia;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class TransferenciaTest extends TestCase
{
    use RefreshDatabase;

    private function contasDoUsuario(): array
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        return [
            Conta::factory()->create(['user_id' => $user->id]),
            Conta::factory()->create(['user_id' => $user->id]),
            $user,
        ];
    }

    private function payload(Conta $origem, Conta $destino, array $extra = []): array
    {
        return [
            'from_account_id' => $origem->id,
            'to_account_id' => $destino->id,
            'amount' => 150.50,
            'date' => '2026-10-05',
            'description' => 'Reserva',
            ...$extra,
        ];
    }

    #[Test]
    public function cria_transferencia_movendo_o_saldo_entre_as_contas(): void
    {
        [$origem, $destino] = $this->contasDoUsuario();

        $this->postJson('/api/transferencias/criar', $this->payload($origem, $destino))
            ->assertStatus(201)
            ->assertJsonPath('data.date_raw', '2026-10-05');

        $transferencia = Transferencia::firstOrFail();

        $this->assertDatabaseHas('transactions', [
            'transfer_id' => $transferencia->id,
            'account_id' => $origem->id,
            'type' => TransactionType::EXPENSE->value,
            'status' => TransactionStatus::PAID->value,
            'amount' => 150.50,
        ]);
        $this->assertDatabaseHas('transactions', [
            'transfer_id' => $transferencia->id,
            'account_id' => $destino->id,
            'type' => TransactionType::INCOME->value,
            'status' => TransactionStatus::PAID->value,
            'amount' => 150.50,
        ]);

        $this->assertEquals(-150.50, $origem->fresh()->saldo);
        $this->assertEquals(150.50, $destino->fresh()->saldo);
    }

    #[Test]
    public function nao_permite_origem_igual_ao_destino(): void
    {
        [$origem] = $this->contasDoUsuario();

        $this->postJson('/api/transferencias/criar', $this->payload($origem, $origem))
            ->assertStatus(422)
            ->assertJsonValidationErrors('to_account_id');
    }

    #[Test]
    public function nao_permite_usar_conta_de_outro_usuario(): void
    {
        [$origem] = $this->contasDoUsuario();
        $contaAlheia = Conta::factory()->create();

        $this->postJson('/api/transferencias/criar', $this->payload($origem, $contaAlheia))
            ->assertStatus(422)
            ->assertJsonValidationErrors('to_account_id');

        $this->assertDatabaseCount('transfers', 0);
    }

    #[Test]
    public function atualiza_transferencia_ajustando_as_duas_transacoes(): void
    {
        [$origem, $destino, $user] = $this->contasDoUsuario();
        $terceira = Conta::factory()->create(['user_id' => $user->id]);

        $this->postJson('/api/transferencias/criar', $this->payload($origem, $destino));
        $transferencia = Transferencia::firstOrFail();

        $this->putJson("/api/transferencias/atualizar/{$transferencia->id}", $this->payload($origem, $terceira, ['amount' => 40]))
            ->assertOk();

        $this->assertDatabaseCount('transactions', 2);
        $this->assertEquals(0, $destino->fresh()->saldo);
        $this->assertEquals(40, $terceira->fresh()->saldo);
        $this->assertEquals(-40, $origem->fresh()->saldo);
    }

    #[Test]
    public function excluir_a_transferencia_remove_as_duas_transacoes(): void
    {
        [$origem, $destino] = $this->contasDoUsuario();

        $this->postJson('/api/transferencias/criar', $this->payload($origem, $destino));
        $transferencia = Transferencia::firstOrFail();

        $this->deleteJson("/api/transferencias/deletar/{$transferencia->id}")->assertOk();

        $this->assertDatabaseCount('transfers', 0);
        $this->assertDatabaseCount('transactions', 0);
    }

    #[Test]
    public function nao_acessa_transferencia_de_outro_usuario(): void
    {
        $this->contasDoUsuario();
        $alheia = Transferencia::create([
            'user_id' => User::factory()->create()->id,
            'from_account_id' => Conta::factory()->create()->id,
            'to_account_id' => Conta::factory()->create()->id,
            'amount' => 10,
            'date' => '2026-10-01',
        ]);

        $this->getJson("/api/transferencias/{$alheia->id}")->assertForbidden();
        $this->deleteJson("/api/transferencias/deletar/{$alheia->id}")->assertForbidden();
    }

    #[Test]
    public function transferencia_nao_aparece_nas_listagens_de_despesa_e_receita(): void
    {
        [$origem, $destino] = $this->contasDoUsuario();

        $this->postJson('/api/transferencias/criar', $this->payload($origem, $destino, ['date' => now()->toDateString()]));

        $this->getJson('/api/transacoes?type=EXPENSE')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/transacoes?type=INCOME')->assertOk()->assertJsonCount(0, 'data');
    }

    #[Test]
    public function transacao_de_transferencia_nao_e_editavel_nem_excluivel_direto(): void
    {
        [$origem, $destino] = $this->contasDoUsuario();

        $this->postJson('/api/transferencias/criar', $this->payload($origem, $destino));
        $transacao = Transacao::where('account_id', $origem->id)->firstOrFail();

        $this->deleteJson("/api/transacoes/deletar/{$transacao->id}")->assertForbidden();
        $this->putJson("/api/transacoes/{$transacao->id}/valor", ['amount' => 1])->assertForbidden();
        $this->deleteJson('/api/transacoes/deletar-multiplas', ['ids' => [$transacao->id]])->assertOk();

        $this->assertDatabaseCount('transactions', 2);
    }
}
