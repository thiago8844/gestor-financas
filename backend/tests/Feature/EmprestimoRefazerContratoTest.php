<?php

namespace Tests\Feature;

use App\Models\Conta;
use App\Models\Emprestimo;
use App\Models\Transacao;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class EmprestimoRefazerContratoTest extends TestCase
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
        $id = $this->postJson('/api/emprestimos/criar', $this->payload($extra))->assertStatus(201)->json('data.id');

        return Emprestimo::findOrFail($id);
    }

    #[Test]
    public function refaz_valor_taxa_e_prazo_substituindo_o_cronograma(): void
    {
        $emprestimo = $this->criar();

        $this->putJson("/api/emprestimos/{$emprestimo->id}/contrato", $this->payload(['principal' => 10000, 'rate' => 3, 'installments' => 6]))
            ->assertOk()
            ->assertJsonPath('data.principal', 10000)
            ->assertJsonPath('data.installments', 6);

        $emprestimo->refresh();
        $this->assertCount(6, $emprestimo->parcelas);
        $this->assertEquals(300, $emprestimo->parcelas->first()->interest_amount);
        $this->assertDatabaseHas('loan_events', ['loan_id' => $emprestimo->id, 'type' => 'contrato_editado']);
    }

    #[Test]
    public function atualiza_o_lancamento_do_principal_conforme_movimentar_conta(): void
    {
        $emprestimo = $this->criar(['movimentar_conta' => true]);
        $this->assertEquals(5000, Transacao::where('loan_id', $emprestimo->id)->sole()->amount);

        $this->putJson("/api/emprestimos/{$emprestimo->id}/contrato", $this->payload(['principal' => 7000, 'movimentar_conta' => true]))->assertOk();
        $this->assertEquals(7000, Transacao::where('loan_id', $emprestimo->id)->sole()->amount);

        $this->putJson("/api/emprestimos/{$emprestimo->id}/contrato", $this->payload(['principal' => 7000]))->assertOk();
        $this->assertSame(0, Transacao::where('loan_id', $emprestimo->id)->count());
    }

    #[Test]
    public function detalhe_informa_se_o_contrato_e_editavel(): void
    {
        $emprestimo = $this->criar();

        $this->getJson("/api/emprestimos/{$emprestimo->id}")
            ->assertJsonPath('data.contrato_editavel', true)
            ->assertJsonPath('data.principal_movimentado', false);

        $parcela = $emprestimo->parcelas->first();
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar", ['paid_at' => '2026-11-26'])->assertOk();

        $this->getJson("/api/emprestimos/{$emprestimo->id}")->assertJsonPath('data.contrato_editavel', false);
    }

    #[Test]
    public function recusa_quando_ja_houve_baixa(): void
    {
        $emprestimo = $this->criar();
        $parcela = $emprestimo->parcelas->first();
        $this->postJson("/api/emprestimos/{$emprestimo->id}/parcelas/{$parcela->id}/baixar", ['paid_at' => '2026-11-26'])->assertOk();

        $this->putJson("/api/emprestimos/{$emprestimo->id}/contrato", $this->payload(['principal' => 9000]))->assertStatus(422);

        $this->assertEquals(5000, $emprestimo->fresh()->principal);
    }

    #[Test]
    public function recusa_emprestimo_de_outro_usuario_e_parametros_invalidos(): void
    {
        $emprestimo = $this->criar();

        $this->putJson("/api/emprestimos/{$emprestimo->id}/contrato", $this->payload(['modality' => 'PRICE', 'installments' => null]))->assertStatus(422);

        Sanctum::actingAs(User::factory()->create());
        $this->putJson("/api/emprestimos/{$emprestimo->id}/contrato", $this->payload(["account_id" => null]))->assertStatus(403);
    }
}
