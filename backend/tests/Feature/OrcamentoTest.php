<?php

namespace Tests\Feature;

use App\Actions\CriarTransacaoParcelada;
use App\Actions\Orcamentos\AtualizarOrcamento;
use App\Actions\Orcamentos\CalcularOrcamento;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\Orcamento;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class OrcamentoTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function cria_orcamento_pontual_com_intervalo_de_datas(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/orcamentos/criar', [
            'name' => 'Viagem Argentina',
            'type' => 'ONE_TIME',
            'amount_limit' => 8000,
            'periodos' => [
                ['start_date' => '2026-10-01', 'end_date' => '2026-10-15'],
            ],
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('budgets', ['name' => 'Viagem Argentina', 'type' => 'ONE_TIME']);
        $this->assertDatabaseHas('budget_periods', ['start_date' => '2026-10-01', 'end_date' => '2026-10-15']);
    }

    #[Test]
    public function orcamento_recorrente_exige_frequencia_e_data_inicio(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/orcamentos/criar', [
            'name' => 'Lazer',
            'type' => 'RECURRING',
            'amount_limit' => 800,
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['frequency', 'start_date']);
    }

    #[Test]
    public function calcula_gasto_recorrente_considerando_apenas_transacoes_do_periodo(): void
    {
        $conta = Conta::factory()->create();

        $orcamento = Orcamento::create([
            'user_id' => $conta->user_id,
            'name' => 'Lazer',
            'type' => 'RECURRING',
            'amount_limit' => 800,
            'frequency' => 'MONTHLY',
            'interval' => 1,
            'start_date' => '2026-01-01',
        ]);

        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'budget_id' => $orcamento->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Cinema',
            'amount' => 120,
            'status' => TransactionStatus::PAID,
            'date' => '2026-08-05',
        ]);

        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'budget_id' => $orcamento->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Show',
            'amount' => 200,
            'status' => TransactionStatus::PAID,
            'date' => '2026-08-20',
        ]);

        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'budget_id' => $orcamento->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Setembro',
            'amount' => 300,
            'status' => TransactionStatus::PENDING,
            'due_date' => '2026-09-10',
        ]);

        $resumoAgosto = (new CalcularOrcamento())->executar($orcamento, Carbon::parse('2026-08-15'));

        $this->assertEquals(320, $resumoAgosto['gasto']);
        $this->assertEquals(480, $resumoAgosto['disponivel']);
        $this->assertEquals(40.0, $resumoAgosto['percentual_utilizado']);

        $resumoSetembro = (new CalcularOrcamento())->executar($orcamento, Carbon::parse('2026-09-15'));
        $this->assertEquals(300, $resumoSetembro['gasto']);
    }

    #[Test]
    public function compra_parcelada_com_ignore_pending_installments_conta_valor_total_uma_unica_vez(): void
    {
        $conta = Conta::factory()->create();

        $orcamento = Orcamento::create([
            'user_id' => $conta->user_id,
            'name' => 'Viagem Argentina',
            'type' => 'ONE_TIME',
            'amount_limit' => 8000,
            'ignore_pending_installments' => true,
        ]);

        $orcamento->periodos()->create(['start_date' => '2026-10-01', 'end_date' => '2026-10-15']);

        CriarTransacaoParcelada::executar($conta->user_id, [
            'account_id' => $conta->id,
            'type' => 'EXPENSE',
            'description' => 'Passagem',
            'installment_total' => 12,
            'budget_id' => $orcamento->id,
            'parcelas' => collect(range(0, 11))->map(fn ($i) => [
                'amount' => 300,
                'date' => $i === 0 ? '2026-10-05' : null,
                'due_date' => $i === 0 ? null : Carbon::parse('2026-10-05')->addMonths($i)->toDateString(),
                'status' => $i === 0 ? 'PAID' : 'PENDING',
            ])->all(),
        ]);

        $resumo = (new CalcularOrcamento())->executar($orcamento->fresh(['periodos']));

        $this->assertEquals(3600, $resumo['gasto']);
        $this->assertEquals(4400, $resumo['disponivel']);
    }

    #[Test]
    public function sem_ignore_pending_installments_cada_parcela_conta_no_seu_proprio_periodo(): void
    {
        $conta = Conta::factory()->create();

        $orcamento = Orcamento::create([
            'user_id' => $conta->user_id,
            'name' => 'Viagem Argentina',
            'type' => 'ONE_TIME',
            'amount_limit' => 8000,
            'ignore_pending_installments' => false,
        ]);

        $orcamento->periodos()->create(['start_date' => '2026-10-01', 'end_date' => '2026-10-15']);

        CriarTransacaoParcelada::executar($conta->user_id, [
            'account_id' => $conta->id,
            'type' => 'EXPENSE',
            'description' => 'Passagem',
            'installment_total' => 12,
            'budget_id' => $orcamento->id,
            'parcelas' => collect(range(0, 11))->map(fn ($i) => [
                'amount' => 300,
                'date' => $i === 0 ? '2026-10-05' : null,
                'due_date' => $i === 0 ? null : Carbon::parse('2026-10-05')->addMonths($i)->toDateString(),
                'status' => $i === 0 ? 'PAID' : 'PENDING',
            ])->all(),
        ]);

        $resumo = (new CalcularOrcamento())->executar($orcamento->fresh(['periodos']));

        // só a parcela nº1 (05/10) cai dentro do intervalo 01/10-15/10
        $this->assertEquals(300, $resumo['gasto']);
    }

    #[Test]
    public function alterar_limite_a_partir_do_proximo_periodo_preserva_o_periodo_atual(): void
    {
        $conta = Conta::factory()->create();

        $orcamento = Orcamento::create([
            'user_id' => $conta->user_id,
            'name' => 'Lazer',
            'type' => 'RECURRING',
            'amount_limit' => 800,
            'frequency' => 'MONTHLY',
            'interval' => 1,
            'start_date' => '2026-01-01',
        ]);

        $orcamento->refresh();

        AtualizarOrcamento::executar($orcamento, [
            'name' => 'Lazer',
            'amount_limit' => 1000,
            'limite_aplicar_a_partir' => 'proximo',
        ], Carbon::parse('2026-08-15'));

        $orcamento->refresh();

        $this->assertEquals(800, $orcamento->limiteEm(Carbon::parse('2026-08-15')));
        $this->assertEquals(1000, $orcamento->limiteEm(Carbon::parse('2026-09-01')));
    }

    #[Test]
    public function lista_apenas_orcamentos_do_usuario_autenticado(): void
    {
        $conta = Conta::factory()->create();
        $outraConta = Conta::factory()->create();

        Orcamento::create([
            'user_id' => $conta->user_id,
            'name' => 'Meu orçamento',
            'type' => 'ONE_TIME',
        ]);

        Orcamento::create([
            'user_id' => $outraConta->user_id,
            'name' => 'Orçamento de outro usuário',
            'type' => 'ONE_TIME',
        ]);

        Sanctum::actingAs($conta->user);

        $response = $this->getJson('/api/orcamentos');

        $response->assertStatus(200);
        $response->assertJsonCount(1, 'data');
        $response->assertJsonPath('data.0.name', 'Meu orçamento');
    }
}
