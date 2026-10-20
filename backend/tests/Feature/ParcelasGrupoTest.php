<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Models\Cartao;
use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ParcelasGrupoTest extends TestCase
{
    use RefreshDatabase;

    private Conta $conta;
    private Cartao $cartao;

    protected function setUp(): void
    {
        parent::setUp();

        $this->conta = Conta::factory()->create();
        Sanctum::actingAs($this->conta->user);

        $this->cartao = Cartao::create([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'name' => 'Cartão', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);
    }

    private function grupoNoCartao(): string
    {
        return $this->postJson('/api/transacoes/cartao', [
            'card_id' => $this->cartao->id, 'description' => 'Notebook', 'amount' => 1000,
            'purchase_date' => '2026-09-05', 'installment_total' => 3,
        ])->assertCreated()->json('installment_group');
    }

    private function grupoNaConta(): string
    {
        $parcelas = [];
        foreach ([1, 2, 3] as $i) {
            $parcelas[] = ['amount' => 100, 'due_date' => "2026-1{$i}-10", 'status' => 'PENDING'];
        }
        $parcelas[0]['due_date'] = '2026-10-10';
        $parcelas[1]['due_date'] = '2026-11-10';
        $parcelas[2]['due_date'] = '2026-12-10';

        return $this->postJson('/api/transacoes/parceladas', [
            'account_id' => $this->conta->id, 'type' => 'EXPENSE', 'description' => 'Sofá',
            'amount' => 300, 'installment_total' => 3, 'parcelas' => $parcelas,
        ])->assertCreated()->json('installment_group');
    }

    private function ids(string $grupo): array
    {
        return Transacao::parcelasDoGrupo($grupo)->pluck('id')->all();
    }

    #[Test]
    public function mostra_o_grupo_com_total_e_parcelas(): void
    {
        $grupo = $this->grupoNoCartao();

        $this->getJson("/api/transacoes/grupos/{$grupo}")->assertOk()
            ->assertJsonPath('data.tipo', 'cartao')
            ->assertJsonPath('data.total', 1000)
            ->assertJsonCount(3, 'data.parcelas')
            ->assertJsonPath('data.parcelas.0.travada', false);
    }

    #[Test]
    public function edita_valores_do_grupo_no_cartao_e_recalcula_o_total_da_fatura(): void
    {
        $grupo = $this->grupoNoCartao();
        [$a, $b, $c] = $this->ids($grupo);

        $this->putJson("/api/transacoes/grupos/{$grupo}", ['parcelas' => [
            ['id' => $a, 'amount' => 333.34], ['id' => $b, 'amount' => 333.33], ['id' => $c, 'amount' => 333.33],
        ]])->assertOk()->assertJsonPath('total_anterior', 1000)->assertJsonPath('data.total', 1000);

        $this->assertSame([333.34, 333.33, 333.33], Transacao::parcelasDoGrupo($grupo)->pluck('amount')->map(fn ($v) => (float) $v)->all());

        $fatura = Transacao::find($a)->fatura->fresh();
        $this->assertSame(333.34, $fatura->resumoValores()['total']);
    }

    #[Test]
    public function propaga_descricao_e_categoria_para_todas_as_parcelas(): void
    {
        $grupo = $this->grupoNoCartao();
        $categoria = Categoria::create(['user_id' => $this->conta->user_id, 'name' => 'Informática']);

        $this->putJson("/api/transacoes/grupos/{$grupo}", [
            'description' => 'Notebook Dell', 'category_id' => $categoria->id,
        ])->assertOk();

        $this->assertSame(3, Transacao::where('installment_group', $grupo)
            ->where('description', 'Notebook Dell')->where('category_id', $categoria->id)->count());
    }

    #[Test]
    public function move_parcela_de_cartao_para_outra_fatura(): void
    {
        $grupo = $this->grupoNoCartao();
        [$a] = $this->ids($grupo);

        // Fecha dia 10, vence dia 20: compra de 05/09 cai na fatura de setembro; move para dezembro.
        $this->putJson("/api/transacoes/grupos/{$grupo}", ['parcelas' => [
            ['id' => $a, 'invoice_month' => '2026-12-01'],
        ]])->assertOk();

        $fatura = Transacao::find($a)->fatura;
        $this->assertSame('2026-12-01', $fatura->reference_month->toDateString());
        $this->assertSame('2026-12-20', $fatura->due_date->toDateString());
        $this->assertSame('2026-12-20', Transacao::find($a)->due_date->toDateString());
    }

    #[Test]
    public function edita_vencimento_e_valor_no_grupo_da_conta(): void
    {
        $grupo = $this->grupoNaConta();
        [$a, $b] = $this->ids($grupo);

        $this->putJson("/api/transacoes/grupos/{$grupo}", ['parcelas' => [
            ['id' => $a, 'amount' => 99.99, 'due_date' => '2026-10-15'],
            ['id' => $b, 'amount' => 100.01],
        ]])->assertOk();

        $this->assertSame(99.99, (float) Transacao::find($a)->amount);
        $this->assertSame('2026-10-15', Transacao::find($a)->due_date->toDateString());
        $this->assertSame(100.01, (float) Transacao::find($b)->amount);
    }

    #[Test]
    public function parcela_paga_fica_travada_para_valor_mas_aceita_descricao(): void
    {
        $grupo = $this->grupoNaConta();
        [$a, $b] = $this->ids($grupo);
        Transacao::find($a)->update(['status' => TransactionStatus::PAID, 'date' => '2026-10-10']);

        $this->putJson("/api/transacoes/grupos/{$grupo}", ['parcelas' => [
            ['id' => $a, 'amount' => 50], ['id' => $b, 'amount' => 150],
        ]])->assertStatus(422);

        // Nada foi gravado (nem a parcela livre).
        $this->assertSame(100.0, (float) Transacao::find($b)->amount);

        $this->putJson("/api/transacoes/grupos/{$grupo}", ['description' => 'Sofá novo'])->assertOk();
        $this->assertSame('Sofá novo', Transacao::find($a)->description);
    }

    #[Test]
    public function nao_edita_grupo_de_outro_usuario(): void
    {
        $grupo = $this->grupoNoCartao();
        Sanctum::actingAs(Conta::factory()->create()->user);

        $this->getJson("/api/transacoes/grupos/{$grupo}")->assertNotFound();
        $this->putJson("/api/transacoes/grupos/{$grupo}", ['description' => 'x'])->assertNotFound();
        $this->deleteJson("/api/transacoes/grupos/{$grupo}")->assertStatus(422);
        $this->assertSame(3, Transacao::where('installment_group', $grupo)->count());
    }

    #[Test]
    public function recusa_parcela_que_nao_pertence_ao_grupo(): void
    {
        $grupo = $this->grupoNoCartao();
        $outro = $this->grupoNaConta();
        [$intruso] = $this->ids($outro);

        $this->putJson("/api/transacoes/grupos/{$grupo}", ['parcelas' => [['id' => $intruso, 'amount' => 1]]])
            ->assertStatus(422);
    }

    #[Test]
    public function exclui_o_grupo_inteiro(): void
    {
        $grupo = $this->grupoNoCartao();

        $this->deleteJson("/api/transacoes/grupos/{$grupo}")->assertOk()->assertJsonPath('excluidas', 3);

        $this->assertSame(0, Transacao::where('installment_group', $grupo)->count());
    }

    #[Test]
    public function nao_exclui_grupo_com_parcela_paga(): void
    {
        $grupo = $this->grupoNaConta();
        Transacao::parcelasDoGrupo($grupo)->first()->update(['status' => TransactionStatus::PAID, 'date' => '2026-10-10']);

        $this->deleteJson("/api/transacoes/grupos/{$grupo}")->assertStatus(422);

        $this->assertSame(3, Transacao::where('installment_group', $grupo)->count());
    }

    #[Test]
    public function valor_de_parcela_de_cartao_paga_nao_pode_ser_alterado(): void
    {
        $grupo = $this->grupoNoCartao();
        [$a, $b] = $this->ids($grupo);
        Transacao::find($a)->update(['status' => TransactionStatus::PAID, 'date' => '2026-09-20']);

        $this->putJson("/api/transacoes/{$a}/valor", ['amount' => 1])->assertStatus(422);
        $this->putJson("/api/transacoes/{$b}/valor", ['amount' => 340, 'description' => 'Outro nome'])->assertOk();

        $this->assertSame('Outro nome', Transacao::find($b)->description);
    }

    #[Test]
    public function recusa_soma_diferente_do_total_na_parcelada_da_conta(): void
    {
        $this->postJson('/api/transacoes/parceladas', [
            'account_id' => $this->conta->id, 'type' => 'EXPENSE', 'description' => 'Sofá',
            'amount' => 300, 'installment_total' => 2,
            'parcelas' => [
                ['amount' => 100, 'due_date' => '2026-10-10', 'status' => 'PENDING'],
                ['amount' => 100, 'due_date' => '2026-11-10', 'status' => 'PENDING'],
            ],
        ])->assertStatus(422)->assertJsonValidationErrors('parcelas');
    }
}
