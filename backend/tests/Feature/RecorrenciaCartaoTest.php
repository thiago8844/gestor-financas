<?php

namespace Tests\Feature;

use App\Actions\GerarTransacoesRecorrentes;
use App\Enums\TransactionStatus;
use App\Models\Cartao;
use App\Models\Conta;
use App\Models\Fatura;
use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RecorrenciaCartaoTest extends TestCase
{
    use RefreshDatabase;

    private function cartao(Conta $conta, array $extra = []): Cartao
    {
        return Cartao::create(array_merge([
            'user_id' => $conta->user_id, 'account_id' => $conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ], $extra));
    }

    private function payload(array $extra = []): array
    {
        return array_merge([
            'type' => 'EXPENSE',
            'description' => 'Netflix',
            'amount' => 55.90,
            'frequency' => 'MONTHLY',
            'interval' => 1,
            'day_of_month' => 15,
            'start_date' => '2026-08-15',
        ], $extra);
    }

    #[Test]
    public function cria_recorrencia_no_cartao_usando_a_conta_do_cartao_e_nascendo_pendente(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = $this->cartao($conta);

        // Mesmo mandando "paga" e outra conta, o servidor ignora: no cartão a baixa é da fatura.
        $outraConta = Conta::factory()->create(['user_id' => $conta->user_id]);
        $this->postJson('/api/recorrencias/criar', $this->payload([
            'card_id' => $cartao->id, 'account_id' => $outraConta->id, 'default_status' => 'PAID',
        ]))->assertStatus(201)->assertJsonPath('data.card_id', $cartao->id);

        $this->assertDatabaseHas('recurring_transactions', [
            'card_id' => $cartao->id, 'account_id' => $conta->id, 'default_status' => 'PENDING',
        ]);
    }

    #[Test]
    public function cria_no_cartao_sem_mandar_conta_nem_status(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = $this->cartao($conta);

        $this->postJson('/api/recorrencias/criar', $this->payload(['card_id' => $cartao->id]))
            ->assertStatus(201);
    }

    #[Test]
    public function recusa_receita_valor_variavel_e_cartao_de_outro_usuario(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = $this->cartao($conta);
        $cartaoDeOutro = $this->cartao(Conta::factory()->create());

        $this->postJson('/api/recorrencias/criar', $this->payload(['card_id' => $cartao->id, 'type' => 'INCOME']))
            ->assertStatus(422)->assertJsonValidationErrors(['card_id']);

        $semValor = $this->payload(['card_id' => $cartao->id]);
        unset($semValor['amount']);
        $this->postJson('/api/recorrencias/criar', $semValor)
            ->assertStatus(422)->assertJsonValidationErrors(['amount']);

        $this->postJson('/api/recorrencias/criar', $this->payload(['card_id' => $cartaoDeOutro->id]))
            ->assertStatus(422)->assertJsonValidationErrors(['card_id']);
    }

    #[Test]
    public function gera_a_compra_dentro_da_fatura_certa_de_cada_ocorrencia(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = $this->cartao($conta); // fecha dia 10, vence dia 20 do mesmo mês
        $this->postJson('/api/recorrencias/criar', $this->payload(['card_id' => $cartao->id]))->assertStatus(201);

        // Ocorrências: 15/08 e 15/09 — ambas depois do fechamento do dia 10, então caem na fatura do mês seguinte.
        $gerados = (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-09-16'));

        $this->assertSame(2, $gerados);
        $this->assertSame(
            ['2026-09-20', '2026-10-20'],
            Fatura::where('card_id', $cartao->id)->orderBy('due_date')->get()->map(fn ($f) => $f->due_date->toDateString())->all()
        );

        $compras = Transacao::where('card_id', $cartao->id)->orderBy('purchase_date')->get();
        $this->assertCount(2, $compras);

        $recorrencia = RecorrenciaTransacao::first();
        foreach ($compras as $compra) {
            $this->assertSame(TransactionStatus::PENDING, $compra->status);
            $this->assertNull($compra->date);
            $this->assertSame($conta->id, $compra->account_id);
            $this->assertSame($recorrencia->id, $compra->recurring_transaction_id);
            $this->assertEquals(55.90, $compra->amount);
            $this->assertNotNull($compra->invoice_id);
        }
        $this->assertSame('2026-08-15', $compras[0]->purchase_date->toDateString());
        $this->assertSame('2026-09-20', $compras[0]->due_date->toDateString());
        $this->assertSame('2026-10-20', $compras[1]->due_date->toDateString());
    }

    #[Test]
    public function duas_ocorrencias_na_mesma_fatura_reaproveitam_a_fatura(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = $this->cartao($conta, ['closing_day' => 28, 'due_day' => 5]);
        // Semanal: várias compras no mesmo ciclo da fatura.
        $this->postJson('/api/recorrencias/criar', $this->payload([
            'card_id' => $cartao->id, 'frequency' => 'WEEKLY', 'days_of_week' => [1], 'start_date' => '2026-09-01',
            'day_of_month' => null,
        ]))->assertStatus(201);

        (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-09-20')); // segundas 07 e 14, antes do fechamento (28)

        $this->assertSame(1, Fatura::where('card_id', $cartao->id)->count());
        $this->assertSame(2, Transacao::where('card_id', $cartao->id)->count());
    }

    #[Test]
    public function pode_mudar_uma_recorrencia_de_conta_para_cartao_e_de_volta(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = $this->cartao($conta);

        $id = $this->postJson('/api/recorrencias/criar', $this->payload(['account_id' => $conta->id, 'default_status' => 'PENDING']))
            ->assertStatus(201)->json('data.id');

        $this->putJson("/api/recorrencias/atualizar/{$id}", $this->payload(['card_id' => $cartao->id]))
            ->assertOk()->assertJsonPath('data.card_id', $cartao->id);

        $this->putJson("/api/recorrencias/atualizar/{$id}", $this->payload(['account_id' => $conta->id, 'default_status' => 'PENDING']))
            ->assertOk()->assertJsonPath('data.card_id', null);
    }

    #[Test]
    public function nao_deixa_excluir_cartao_com_recorrencia_vinculada(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $cartao = $this->cartao($conta);
        $this->postJson('/api/recorrencias/criar', $this->payload(['card_id' => $cartao->id]))->assertStatus(201);

        $this->deleteJson("/api/cartoes/deletar/{$cartao->id}")->assertStatus(422);
        $this->assertDatabaseHas('cards', ['id' => $cartao->id]);
    }

    #[Test]
    public function frequencia_mensal_aceita_lista_vazia_de_dias_da_semana(): void
    {
        // O formulário sempre envia days_of_week: [] — só a frequência semanal usa esse campo.
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->postJson('/api/recorrencias/criar', $this->payload([
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'days_of_week' => [],
        ]))->assertStatus(201);
    }
}
