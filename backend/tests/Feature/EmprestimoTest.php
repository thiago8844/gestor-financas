<?php

namespace Tests\Feature;

use App\Actions\Notificacoes\GerarNotificacoes;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\Emprestimo;
use App\Models\EmprestimoParcela;
use App\Models\Transacao;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EmprestimoTest extends TestCase
{
    use RefreshDatabase;

    private User $user;
    private Conta $conta;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::factory()->create();
        $this->conta = Conta::factory()->create(['user_id' => $this->user->id]);
        Sanctum::actingAs($this->user);
    }

    /** Empréstimo de referência: R$ 5.000 a 2% a.m. simples, só juros, dia 26. */
    private function payload(array $extra = []): array
    {
        return [
            'direction' => 'CONCEDIDO',
            'counterparty' => 'Fulano',
            'principal' => 5000,
            'contract_date' => '2026-10-20',
            'interest_type' => 'SIMPLES',
            'rate' => 2,
            'rate_period' => 'MES',
            'modality' => 'JUROS_PERIODICOS',
            'due_day' => 26,
            'first_due_date' => '2026-11-26',
            'installments' => 12,
            'account_id' => $this->conta->id,
            ...$extra,
        ];
    }

    private function criar(array $extra = []): Emprestimo
    {
        $id = $this->postJson('/api/emprestimos/criar', $this->payload($extra))
            ->assertStatus(201)
            ->json('data.id');

        return Emprestimo::findOrFail($id);
    }

    #[Test]
    public function cria_o_emprestimo_de_referencia_com_o_cronograma_de_100_por_mes(): void
    {
        $this->postJson('/api/emprestimos/criar', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('data.status', 'ATIVO')
            ->assertJsonPath('data.installments_total', 12)
            ->assertJsonPath('data.parcelas.0.due_date', '2026-11-26')
            ->assertJsonPath('data.parcelas.0.expected_amount', 100)
            ->assertJsonPath('data.parcelas.11.expected_amount', 5100)
            ->assertJsonPath('data.principal_balance', 5000)
            ->assertJsonPath('data.interest_total', 1200);

        $emprestimo = Emprestimo::firstOrFail();
        $this->assertCount(12, $emprestimo->parcelas);
        // Categoria padrão criada na hora.
        $this->assertDatabaseHas('categories', ['user_id' => $this->user->id, 'name' => 'Empréstimos']);
        // Sem "movimentar_conta" nada é lançado na criação.
        $this->assertSame(0, Transacao::count());
    }

    #[Test]
    public function movimentar_conta_lanca_o_principal_conforme_a_direcao(): void
    {
        $this->criar(['movimentar_conta' => true]);
        $this->criar(['direction' => 'TOMADO', 'movimentar_conta' => true]);

        $this->assertDatabaseHas('transactions', ['type' => TransactionType::EXPENSE->value, 'amount' => 5000, 'description' => 'Empréstimo concedido a Fulano']);
        $this->assertDatabaseHas('transactions', ['type' => TransactionType::INCOME->value, 'amount' => 5000, 'description' => 'Empréstimo recebido de Fulano']);
    }

    #[Test]
    public function movimentar_conta_exige_a_conta(): void
    {
        $this->postJson('/api/emprestimos/criar', $this->payload(['account_id' => null, 'movimentar_conta' => true]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('account_id');
    }

    #[Test]
    public function valida_campos_obrigatorios_e_conta_de_outro_usuario(): void
    {
        $this->postJson('/api/emprestimos/criar', [])->assertStatus(422);

        $contaDeOutro = Conta::factory()->create();
        $this->postJson('/api/emprestimos/criar', $this->payload(['account_id' => $contaDeOutro->id]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('account_id');

        $this->postJson('/api/emprestimos/criar', $this->payload(['modality' => 'PRICE', 'installments' => null]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('installments');
    }

    #[Test]
    public function parcelas_livres_precisam_fechar_com_o_valor_emprestado(): void
    {
        $this->postJson('/api/emprestimos/criar', $this->payload([
            'modality' => 'LIVRE',
            'installments' => null,
            'custom_installments' => [['due_date' => '2026-12-01', 'principal_amount' => 1000]],
        ]))->assertStatus(422);

        $this->assertSame(0, Emprestimo::count());
    }

    #[Test]
    public function previa_calcula_sem_gravar(): void
    {
        $this->postJson('/api/emprestimos/previa', $this->payload(['modality' => 'SAC', 'installments' => 5, 'rate' => 1]))
            ->assertOk()
            ->assertJsonCount(5, 'data.installments')
            ->assertJsonPath('data.installments.0.principal_amount', 1000)
            ->assertJsonPath('data.total_interest', 150);

        $this->assertSame(0, Emprestimo::count());
    }

    #[Test]
    public function baixar_parcela_de_emprestimo_concedido_cria_receita_paga(): void
    {
        $emprestimo = $this->criar();
        $parcela = $emprestimo->parcelas->first();

        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar", ['paid_at' => '2026-11-26'])
            ->assertOk()
            ->assertJsonPath('data.status', 'PAGA')
            ->assertJsonPath('data.paid_amount', 100);

        $this->assertDatabaseHas('transactions', [
            'loan_id' => $emprestimo->id,
            'loan_installment_id' => $parcela->id,
            'account_id' => $this->conta->id,
            'type' => TransactionType::INCOME->value,
            'status' => TransactionStatus::PAID->value,
            'amount' => 100,
        ]);
    }

    #[Test]
    public function baixar_parcela_de_emprestimo_tomado_cria_despesa(): void
    {
        $emprestimo = $this->criar(['direction' => 'TOMADO']);

        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$emprestimo->parcelas->first()->id}/baixar")->assertOk();

        $this->assertDatabaseHas('transactions', ['loan_id' => $emprestimo->id, 'type' => TransactionType::EXPENSE->value, 'amount' => 100]);
    }

    #[Test]
    public function pagamento_parcial_mantem_a_parcela_em_aberto_ate_completar(): void
    {
        $emprestimo = $this->criar();
        $parcela = $emprestimo->parcelas->first();
        $url = "/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar";

        $this->postJson($url, ['amount' => 40])
            ->assertOk()
            ->assertJsonPath('data.status', 'PARCIAL')
            ->assertJsonPath('data.remaining_amount', 60);

        $this->postJson($url, ['amount' => 70])->assertStatus(422);

        $this->postJson($url, ['amount' => 60])->assertOk()->assertJsonPath('data.status', 'PAGA');
        $this->assertSame(2, Transacao::where('loan_installment_id', $parcela->id)->count());

        // Parcela já paga não aceita nova baixa.
        $this->postJson($url)->assertStatus(422);
    }

    #[Test]
    public function baixar_sem_conta_informada_nem_padrao_retorna_erro(): void
    {
        $emprestimo = $this->criar(['account_id' => null]);

        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$emprestimo->parcelas->first()->id}/baixar")
            ->assertStatus(422);

        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$emprestimo->parcelas->first()->id}/baixar", ['account_id' => $this->conta->id])
            ->assertOk();
    }

    #[Test]
    public function reverter_remove_os_lancamentos_e_volta_a_parcela_para_prevista(): void
    {
        $emprestimo = $this->criar();
        $parcela = $emprestimo->parcelas->first();

        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar")->assertOk();
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/reverter")
            ->assertOk()
            ->assertJsonPath('data.status', 'PREVISTA')
            ->assertJsonPath('data.paid_amount', 0);

        $this->assertSame(0, Transacao::count());
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/reverter")->assertStatus(422);
    }

    #[Test]
    public function quita_o_contrato_ao_pagar_todas_as_parcelas_e_reabre_ao_reverter(): void
    {
        $emprestimo = $this->criar(['installments' => 2]);

        foreach ($emprestimo->parcelas as $parcela) {
            $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar")->assertOk();
        }

        $this->assertSame('QUITADO', $emprestimo->fresh()->status->value);

        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$emprestimo->parcelas->last()->id}/reverter")->assertOk();
        $this->assertSame('ATIVO', $emprestimo->fresh()->status->value);
    }

    #[Test]
    public function prazo_aberto_gera_novas_parcelas_conforme_as_antigas_sao_pagas(): void
    {
        $emprestimo = $this->criar(['installments' => null]);
        $this->assertSame(24, $emprestimo->parcelas->count());
        $this->assertTrue($emprestimo->prazoAberto());

        foreach ($emprestimo->parcelas->take(20) as $parcela) {
            $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar")->assertOk();
        }

        $this->assertGreaterThan(24, $emprestimo->parcelas()->count());
        $this->assertSame('ATIVO', $emprestimo->fresh()->status->value);
        // Numeração contínua, sem buracos.
        $this->assertSame($emprestimo->parcelas()->count(), (int) $emprestimo->parcelas()->max('number'));
    }

    #[Test]
    public function encerrar_define_a_data_final_e_devolve_o_principal_na_ultima_parcela(): void
    {
        $emprestimo = $this->criar(['installments' => null]);

        $this->postJson("/api/emprestimos/{$emprestimo->id}/encerrar", ['date' => '2027-03-26'])
            ->assertOk()
            ->assertJsonPath('data.open_term', false);

        $ativas = $emprestimo->parcelas()->where('status', '!=', 'CANCELADA')->get();
        $final = $ativas->last();

        $this->assertSame('2027-03-26', $final->due_date->toDateString());
        $this->assertEquals(5000, $final->expected_amount);
        $this->assertSame(5000.0, round($ativas->sum('principal_amount'), 2));

        // Só vale uma vez.
        $this->postJson("/api/emprestimos/{$emprestimo->id}/encerrar", ['date' => '2027-04-26'])->assertStatus(422);
    }

    #[Test]
    public function excluir_remove_o_emprestimo_e_todos_os_lancamentos_gerados(): void
    {
        $emprestimo = $this->criar(['movimentar_conta' => true]);
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$emprestimo->parcelas->first()->id}/baixar")->assertOk();
        $this->assertSame(2, Transacao::count());

        $this->deleteJson("/api/emprestimos/deletar/{$emprestimo->id}")->assertOk();

        $this->assertSame(0, Emprestimo::count());
        $this->assertSame(0, EmprestimoParcela::count());
        $this->assertSame(0, Transacao::count());
    }

    #[Test]
    public function nao_acessa_nem_altera_emprestimo_de_outro_usuario(): void
    {
        $emprestimo = $this->criar();
        $parcela = $emprestimo->parcelas->first();

        Sanctum::actingAs(User::factory()->create());

        $this->getJson("/api/emprestimos/{$emprestimo->id}")->assertStatus(403);
        $this->deleteJson("/api/emprestimos/deletar/{$emprestimo->id}")->assertStatus(403);
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar")->assertStatus(403);
        $this->getJson('/api/emprestimos')->assertOk()->assertJsonCount(0, 'data');
    }

    #[Test]
    public function parcela_de_outro_emprestimo_nao_pode_ser_baixada_pela_rota_errada(): void
    {
        $a = $this->criar();
        $b = $this->criar(['counterparty' => 'Beltrano']);

        $this->postJson("/api/emprestimos/{$a->id}/parcelas/{$b->parcelas->first()->id}/baixar")->assertStatus(403);
    }

    #[Test]
    public function lista_filtra_por_direcao_e_por_atrasados(): void
    {
        $this->criar();
        $this->criar(['direction' => 'TOMADO', 'counterparty' => 'Banco', 'first_due_date' => now()->subDays(5)->toDateString(), 'due_day' => null]);

        $this->getJson('/api/emprestimos?direction=TOMADO')->assertJsonCount(1, 'data')->assertJsonPath('data.0.counterparty', 'Banco');
        $this->getJson('/api/emprestimos?overdue=1')->assertJsonCount(1, 'data')->assertJsonPath('data.0.counterparty', 'Banco');
        $this->getJson('/api/emprestimos')->assertJsonCount(2, 'data');
    }

    #[Test]
    public function resumo_separa_eu_devo_de_me_devem_e_conta_atrasadas(): void
    {
        $this->criar();
        $this->criar(['direction' => 'TOMADO', 'principal' => 1000, 'modality' => 'SAC', 'installments' => 4, 'rate' => 0,
            'interest_type' => 'SEM_JUROS', 'first_due_date' => now()->subDays(2)->toDateString(), 'due_day' => null]);

        $this->getJson('/api/emprestimos/resumo')
            ->assertOk()
            ->assertJsonPath('data.me_devem.contratos', 1)
            ->assertJsonPath('data.me_devem.saldo_principal', 5000)
            ->assertJsonPath('data.eu_devo.saldo_principal', 1000)
            ->assertJsonPath('data.atrasadas.quantidade', 1)
            ->assertJsonPath('data.atrasadas.valor', 250)
            ->assertJsonCount(3, 'data.proximos_vencimentos');
    }

    #[Test]
    public function registra_nao_pago_no_historico_sem_alterar_a_parcela(): void
    {
        $emprestimo = $this->criar();
        $parcela = $emprestimo->parcelas->first();

        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/nao-paga", ['note' => 'Pediu mais uns dias'])->assertOk();

        $this->assertSame('PREVISTA', $parcela->fresh()->status->value);
        $this->getJson("/api/emprestimos/{$emprestimo->id}/historico")
            ->assertOk()
            ->assertJsonPath('data.0.type', 'parcela_nao_paga');
    }

    #[Test]
    public function atualizar_altera_so_dados_de_identificacao(): void
    {
        $emprestimo = $this->criar();

        $this->putJson("/api/emprestimos/atualizar/{$emprestimo->id}", ['counterparty' => 'Fulano da Silva', 'principal' => 1])
            ->assertOk()
            ->assertJsonPath('data.counterparty', 'Fulano da Silva')
            ->assertJsonPath('data.principal', 5000);
    }

    #[Test]
    public function notifica_parcela_a_vencer_e_atrasada_sem_duplicar(): void
    {
        $this->criar(['first_due_date' => now()->addDay()->toDateString(), 'due_day' => null, 'installments' => 3]);
        $this->criar(['direction' => 'TOMADO', 'counterparty' => 'Banco', 'first_due_date' => now()->subDay()->toDateString(), 'due_day' => null, 'installments' => 3]);

        $criadas = (new GerarNotificacoes())->executar();

        $this->assertSame(2, $criadas);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->user->id, 'type' => 'emprestimo_a_vencer']);
        $this->assertDatabaseHas('notifications', ['user_id' => $this->user->id, 'type' => 'emprestimo_atrasado']);
        $this->assertSame(0, (new GerarNotificacoes())->executar());
    }

    #[Test]
    public function nao_notifica_parcela_ja_paga_nem_contrato_quitado(): void
    {
        $emprestimo = $this->criar(['first_due_date' => now()->addDay()->toDateString(), 'due_day' => null, 'installments' => 1]);
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$emprestimo->parcelas->first()->id}/baixar")->assertOk();

        $this->assertSame(0, (new GerarNotificacoes())->executar());
    }
}
