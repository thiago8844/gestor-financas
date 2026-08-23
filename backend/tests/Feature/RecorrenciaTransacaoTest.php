<?php

namespace Tests\Feature;

use App\Actions\GerarTransacoesRecorrentes;
use App\Enums\FrequenciaRecorrencia;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RecorrenciaTransacaoTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function cria_recorrencia_mensal_com_valor_fixo_nascendo_paga(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/recorrencias/criar', [
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE->value,
            'description' => 'Parcela do seguro',
            'amount' => 199.90,
            'default_status' => TransactionStatus::PAID->value,
            'frequency' => FrequenciaRecorrencia::MONTHLY->value,
            'interval' => 1,
            'day_of_month' => 5,
            'start_date' => '2026-09-05',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.next_run_date', '2026-09-05');

        $this->assertDatabaseHas('recurring_transactions', [
            'description' => 'Parcela do seguro',
            'next_run_date' => '2026-09-05',
        ]);
    }

    #[Test]
    public function nao_permite_nascer_paga_sem_valor_fixo(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/recorrencias/criar', [
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE->value,
            'description' => 'Conta de luz',
            'default_status' => TransactionStatus::PAID->value,
            'frequency' => FrequenciaRecorrencia::MONTHLY->value,
            'day_of_month' => 10,
            'start_date' => '2026-09-10',
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['amount']);
    }

    #[Test]
    public function permite_nascer_pendente_sem_valor_fixo(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/recorrencias/criar', [
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE->value,
            'description' => 'Conta de luz',
            'default_status' => TransactionStatus::PENDING->value,
            'frequency' => FrequenciaRecorrencia::MONTHLY->value,
            'day_of_month' => 10,
            'start_date' => '2026-09-10',
        ]);

        $response->assertStatus(201);
    }

    #[Test]
    public function comando_gera_transacao_paga_com_valor_e_avanca_a_recorrencia(): void
    {
        $conta = Conta::factory()->create();

        $recorrencia = RecorrenciaTransacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Parcela do seguro',
            'amount' => 199.90,
            'default_status' => TransactionStatus::PAID,
            'frequency' => FrequenciaRecorrencia::MONTHLY,
            'interval' => 1,
            'day_of_month' => 5,
            'start_date' => '2026-08-05',
            'next_run_date' => '2026-08-05',
            'active' => true,
        ]);

        $gerados = (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-08-05'));

        $this->assertEquals(1, $gerados);

        $transacao = Transacao::where('recurring_transaction_id', $recorrencia->id)->first();
        $this->assertNotNull($transacao);
        $this->assertEquals(199.90, $transacao->amount);
        $this->assertEquals(TransactionStatus::PAID, $transacao->status);
        $this->assertNotNull($transacao->date);
        $this->assertNull($transacao->due_date);

        $recorrencia->refresh();
        $this->assertEquals('2026-09-05', $recorrencia->next_run_date->toDateString());
        $this->assertNotNull($recorrencia->last_generated_at);
    }

    #[Test]
    public function comando_gera_transacao_pendente_sem_valor_quando_recorrencia_e_variavel(): void
    {
        $conta = Conta::factory()->create();

        $recorrencia = RecorrenciaTransacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Conta de luz',
            'amount' => null,
            'default_status' => TransactionStatus::PENDING,
            'frequency' => FrequenciaRecorrencia::MONTHLY,
            'interval' => 1,
            'day_of_month' => 10,
            'start_date' => '2026-08-10',
            'next_run_date' => '2026-08-10',
            'active' => true,
        ]);

        (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-08-10'));

        $transacao = Transacao::where('recurring_transaction_id', $recorrencia->id)->first();
        $this->assertNotNull($transacao);
        $this->assertNull($transacao->amount);
        $this->assertEquals(TransactionStatus::PENDING, $transacao->status);
        $this->assertNotNull($transacao->due_date);
        $this->assertNull($transacao->date);
    }

    #[Test]
    public function comando_faz_catch_up_de_ocorrencias_atrasadas_e_desativa_apos_end_date(): void
    {
        $conta = Conta::factory()->create();

        $recorrencia = RecorrenciaTransacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Assinatura trimestral',
            'amount' => 50,
            'default_status' => TransactionStatus::PAID,
            'frequency' => FrequenciaRecorrencia::MONTHLY,
            'interval' => 3,
            'day_of_month' => 10,
            'start_date' => '2026-01-10',
            'end_date' => '2026-07-10',
            'next_run_date' => '2026-01-10',
            'active' => true,
        ]);

        // "Hoje" bem à frente pra forçar o catch-up de várias ocorrências de uma vez
        $gerados = (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-12-31'));

        // 10/01, 10/04, 10/07 -> 3 ocorrências dentro do end_date
        $this->assertEquals(3, $gerados);
        $this->assertEquals(3, Transacao::where('recurring_transaction_id', $recorrencia->id)->count());

        $recorrencia->refresh();
        $this->assertFalse($recorrencia->active);
    }
}
