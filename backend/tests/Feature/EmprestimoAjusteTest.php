<?php

namespace Tests\Feature;

use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\Emprestimo;
use App\Models\Transacao;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Datas fixas no passado: o ajuste recebe a própria data ("date"), então nada depende do relógio.
 */
class EmprestimoAjusteTest extends TestCase
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

    private function criar(array $extra = []): Emprestimo
    {
        $id = $this->postJson('/api/emprestimos/criar', [
            'direction' => 'CONCEDIDO',
            'counterparty' => 'Fulano',
            'principal' => 5000,
            'contract_date' => '2026-01-01',
            'interest_type' => 'SIMPLES',
            'rate' => 2,
            'rate_period' => 'MES',
            'modality' => 'JUROS_PERIODICOS',
            'first_due_date' => '2026-02-01',
            'installments' => 12,
            'account_id' => $this->conta->id,
            ...$extra,
        ])->assertStatus(201)->json('data.id');

        return Emprestimo::findOrFail($id);
    }

    private function ajustar(Emprestimo $e, array $dados, string $rota = 'ajustes')
    {
        return $this->postJson("/api/emprestimos/{$e->id}/{$rota}", ['date' => '2026-01-01', ...$dados]);
    }

    #[Test]
    public function devedor_quita_2000_e_os_juros_caem_de_100_para_60(): void
    {
        $emprestimo = $this->criar();

        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 2000])
            ->assertOk()
            ->assertJsonPath('data.principal_balance', 3000)
            ->assertJsonPath('data.parcelas.0.interest_amount', 60)
            ->assertJsonPath('data.parcelas.11.principal_amount', 3000)
            ->assertJsonPath('data.parcelas.11.expected_amount', 3060);

        // O valor recebido entra na conta como receita.
        $this->assertDatabaseHas('transactions', [
            'loan_id' => $emprestimo->id,
            'type' => TransactionType::INCOME->value,
            'amount' => 2000,
            'account_id' => $this->conta->id,
        ]);
        $this->assertCount(12, $emprestimo->parcelas()->get());
    }

    #[Test]
    public function contrato_sem_prazo_final_tambem_reduz_os_juros_e_encerra_com_o_saldo_novo(): void
    {
        $emprestimo = $this->criar(['installments' => null]);

        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 2000])
            ->assertOk()
            ->assertJsonPath('data.principal_balance', 3000)
            ->assertJsonPath('data.parcelas.0.interest_amount', 60);

        $this->postJson("/api/emprestimos/{$emprestimo->id}/encerrar", ['date' => '2027-06-01'])->assertOk();

        $final = $emprestimo->parcelas()->reorder()->orderByDesc('number')->first();
        $this->assertEquals(3000, $final->expected_amount);
    }

    #[Test]
    public function juros_proporcionais_sao_cobrados_junto_da_amortizacao(): void
    {
        $emprestimo = $this->criar();

        // 15 dos 31 dias do primeiro período: 1000 x 2% x 15/31 = 9,68.
        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 1000, 'date' => '2026-01-16'])->assertOk();

        $this->assertDatabaseHas('loan_adjustments', ['loan_id' => $emprestimo->id, 'amount' => 1000, 'accrued_interest' => 9.68]);
        $this->assertDatabaseHas('transactions', ['loan_id' => $emprestimo->id, 'amount' => 1009.68]);
    }

    #[Test]
    public function price_manter_prazo_diminui_a_parcela_e_manter_parcela_diminui_o_prazo(): void
    {
        $price = ['modality' => 'PRICE', 'principal' => 10000, 'rate' => 1.5];
        $a = $this->criar($price);
        $b = $this->criar($price);
        $parcelaOriginal = (float) $a->parcelas->first()->expected_amount;

        $this->ajustar($a, ['type' => 'AMORTIZACAO', 'amount' => 3000, 'mode' => 'MANTER_PRAZO'])->assertOk();
        $this->ajustar($b, ['type' => 'AMORTIZACAO', 'amount' => 3000, 'mode' => 'MANTER_PARCELA'])->assertOk();

        $a->refresh()->load('parcelas');
        $b->refresh()->load('parcelas');

        $this->assertCount(12, $a->parcelas);
        $this->assertLessThan($parcelaOriginal, (float) $a->parcelas->first()->expected_amount);
        $this->assertSame(7000.0, round($a->parcelas->sum('principal_amount'), 2));

        $this->assertLessThan(12, $b->parcelas->count());
        // O valor da parcela é mantido; só a última sai menor.
        $this->assertEqualsWithDelta($parcelaOriginal, (float) $b->parcelas->first()->expected_amount, 0.01);
        $this->assertLessThan($parcelaOriginal, (float) $b->parcelas->last()->expected_amount);
        $this->assertSame(7000.0, round($b->parcelas->sum('principal_amount'), 2));
    }

    #[Test]
    public function parcelas_ja_pagas_ficam_e_a_numeracao_continua(): void
    {
        $emprestimo = $this->criar(['modality' => 'SAC', 'principal' => 1200, 'rate' => 1, 'installments' => 6]);
        $primeira = $emprestimo->parcelas->first();
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$primeira->id}/baixar", ['paid_at' => '2026-02-01'])->assertOk();

        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 400, 'date' => '2026-02-10'])->assertOk();

        $parcelas = $emprestimo->parcelas()->get();
        $this->assertSame('PAGA', $parcelas->first()->status->value);
        $this->assertSame([1, 2, 3, 4, 5, 6], $parcelas->pluck('number')->all());
        // Restavam 1.000 de principal em 5 parcelas; abatendo 400, ficam 600 em 5 parcelas de 120.
        $this->assertEquals(120, $parcelas[1]->principal_amount);
    }

    #[Test]
    public function amortizar_tudo_cancela_as_parcelas_futuras_e_quita_o_contrato(): void
    {
        $emprestimo = $this->criar(['modality' => 'SAC', 'principal' => 1000, 'rate' => 0, 'interest_type' => 'SEM_JUROS', 'installments' => 4]);

        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 1000])
            ->assertOk()
            ->assertJsonPath('data.status', 'QUITADO')
            ->assertJsonPath('data.principal_balance', 0);

        $this->assertSame(0, $emprestimo->parcelas()->count());
    }

    #[Test]
    public function aumento_soma_ao_principal_recalcula_os_juros_e_lanca_a_saida(): void
    {
        $emprestimo = $this->criar();

        $this->ajustar($emprestimo, ['type' => 'AUMENTO', 'amount' => 1000])
            ->assertOk()
            ->assertJsonPath('data.principal', 6000)
            ->assertJsonPath('data.principal_balance', 6000)
            ->assertJsonPath('data.parcelas.0.interest_amount', 120)
            ->assertJsonPath('data.parcelas.11.expected_amount', 6120);

        // Emprestou mais: o dinheiro sai da conta.
        $this->assertDatabaseHas('transactions', ['loan_id' => $emprestimo->id, 'type' => TransactionType::EXPENSE->value, 'amount' => 1000]);
    }

    #[Test]
    public function aumento_no_meio_do_periodo_desconta_a_fracao_ja_passada(): void
    {
        $emprestimo = $this->criar();

        // 15/31 dias: o dinheiro novo rendeu 1000 x 2% x 15/31 = 9,68 a menos no primeiro mês (120 - 9,68).
        $this->ajustar($emprestimo, ['type' => 'AUMENTO', 'amount' => 1000, 'date' => '2026-01-16'])
            ->assertOk()
            ->assertJsonPath('data.parcelas.0.interest_amount', 110.32)
            ->assertJsonPath('data.parcelas.1.interest_amount', 120);
    }

    #[Test]
    public function aumento_pode_ser_so_registro_sem_mexer_na_conta_e_com_novo_prazo(): void
    {
        $emprestimo = $this->criar();

        $this->ajustar($emprestimo, ['type' => 'AUMENTO', 'amount' => 1000, 'movimentar_conta' => false, 'installments' => 18])
            ->assertOk()
            ->assertJsonPath('data.installments_total', 18);

        $this->assertSame(0, Transacao::count());
    }

    #[Test]
    public function aumento_reabre_contrato_quitado(): void
    {
        $emprestimo = $this->criar(['installments' => 1]);
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$emprestimo->parcelas->first()->id}/baixar", ['paid_at' => '2026-02-01'])->assertOk();
        $this->assertSame('QUITADO', $emprestimo->fresh()->status->value);

        // Sem parcelas futuras, é preciso dizer em quantas o novo valor será pago.
        $this->ajustar($emprestimo, ['type' => 'AUMENTO', 'amount' => 1000, 'date' => '2026-03-01'])->assertStatus(422);

        $this->ajustar($emprestimo, ['type' => 'AUMENTO', 'amount' => 1000, 'date' => '2026-03-01', 'installments' => 3])
            ->assertOk()
            ->assertJsonPath('data.status', 'ATIVO')
            ->assertJsonPath('data.parcelas.1.number', 2);
    }

    #[Test]
    public function simular_mostra_o_efeito_sem_gravar_nada(): void
    {
        $emprestimo = $this->criar();

        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 2000], 'ajustes/simular')
            ->assertOk()
            ->assertJsonPath('data.balance_before', 5000)
            ->assertJsonPath('data.balance_after', 3000)
            ->assertJsonPath('data.next_amount_before', 100)
            ->assertJsonPath('data.next_amount_after', 60)
            ->assertJsonPath('data.interest_before', 1200)
            ->assertJsonPath('data.interest_after', 720)
            ->assertJsonPath('data.interest_difference', 480);

        $this->assertSame(0, Transacao::count());
        $this->assertDatabaseCount('loan_adjustments', 0);
        $this->assertEquals(100, $emprestimo->parcelas()->first()->interest_amount);
    }

    #[Test]
    public function rejeita_valor_acima_do_saldo_modalidade_nao_suportada_e_parcela_parcial(): void
    {
        $emprestimo = $this->criar();
        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 5000.01])->assertStatus(422);

        $unico = $this->criar(['modality' => 'PAGAMENTO_UNICO', 'installments' => null]);
        $this->ajustar($unico, ['type' => 'AMORTIZACAO', 'amount' => 100])->assertStatus(422);

        $parcial = $this->criar();
        $segunda = $parcial->parcelas[1];
        $this->postJson("/api/emprestimos/{$parcial->id}/parcelas/{$segunda->id}/baixar", ['amount' => 10, 'paid_at' => '2026-03-01'])->assertOk();
        $this->ajustar($parcial, ['type' => 'AMORTIZACAO', 'amount' => 100])->assertStatus(422);

        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 0])->assertStatus(422);
        $this->ajustar($emprestimo, ['type' => 'OUTRO', 'amount' => 10])->assertStatus(422);
    }

    #[Test]
    public function amortizacao_exige_conta_e_nao_mexe_em_outro_usuario(): void
    {
        $semConta = $this->criar(['account_id' => null]);
        $this->ajustar($semConta, ['type' => 'AMORTIZACAO', 'amount' => 100])->assertStatus(422);
        $this->ajustar($semConta, ['type' => 'AMORTIZACAO', 'amount' => 100, 'account_id' => $this->conta->id])->assertOk();

        Sanctum::actingAs(User::factory()->create());
        $this->ajustar($semConta, ['type' => 'AMORTIZACAO', 'amount' => 100])->assertStatus(403);
        $this->ajustar($semConta, ['type' => 'AMORTIZACAO', 'amount' => 100], 'ajustes/simular')->assertStatus(403);
    }

    #[Test]
    public function excluir_o_emprestimo_remove_tambem_os_lancamentos_dos_ajustes(): void
    {
        $emprestimo = $this->criar();
        $this->ajustar($emprestimo, ['type' => 'AMORTIZACAO', 'amount' => 500])->assertOk();
        $this->assertSame(1, Transacao::count());

        $this->deleteJson("/api/emprestimos/deletar/{$emprestimo->id}")->assertOk();

        $this->assertSame(0, Transacao::count());
        $this->assertDatabaseCount('loan_adjustments', 0);
    }
}
