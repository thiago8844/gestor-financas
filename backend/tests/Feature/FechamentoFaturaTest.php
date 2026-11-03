<?php

namespace Tests\Feature;

use App\Models\Cartao;
use App\Models\Conta;
use App\Models\Fatura;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class FechamentoFaturaTest extends TestCase
{
    use RefreshDatabase;

    private Conta $conta;
    private Cartao $cartao;

    protected function setUp(): void
    {
        parent::setUp();

        $this->conta = Conta::factory()->create();
        Sanctum::actingAs($this->conta->user);

        // Vence dia 1, fecha 7 dias antes (dia 24 do mês anterior).
        $this->cartao = Cartao::create([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'name' => 'Cartão', 'closing_day' => 1, 'due_day' => 1, 'active' => true,
            'closing_rule' => 'DAYS_BEFORE_DUE', 'closing_days_before_due' => 7,
        ]);
    }

    private function comprar(string $data, array $extra = []): Transacao
    {
        $id = $this->postJson('/api/transacoes/cartao', array_merge([
            'card_id' => $this->cartao->id, 'description' => 'Compra', 'amount' => 100, 'purchase_date' => $data,
        ], $extra))->assertCreated()->json('data.0.id') ?? Transacao::latest('id')->value('id');

        return Transacao::with('fatura')->findOrFail($id);
    }

    #[Test]
    public function regra_de_dias_antes_do_vencimento_define_o_fechamento(): void
    {
        $dentro = $this->comprar('2026-09-24');
        $fora = $this->comprar('2026-09-25');

        $this->assertSame('2026-10-01', $dentro->fatura->due_date->toDateString());
        $this->assertSame('2026-09-24', $dentro->fatura->closing_date->toDateString());
        $this->assertSame('2026-11-01', $fora->fatura->due_date->toDateString());
    }

    #[Test]
    public function criar_cartao_com_a_regra_nova(): void
    {
        $this->postJson('/api/cartoes/criar', [
            'name' => 'Outro', 'account_id' => $this->conta->id, 'due_day' => 10,
            'closing_rule' => 'DAYS_BEFORE_DUE', 'closing_days_before_due' => 5,
        ])->assertCreated()->assertJsonPath('data.closing_rule', 'DAYS_BEFORE_DUE')
            ->assertJsonPath('data.closing_days_before_due', 5);

        $this->postJson('/api/cartoes/criar', [
            'name' => 'Sem dias', 'account_id' => $this->conta->id, 'due_day' => 10, 'closing_rule' => 'DAYS_BEFORE_DUE',
        ])->assertUnprocessable();
    }

    #[Test]
    public function mudar_o_vencimento_realoca_as_despesas_pendentes(): void
    {
        $compra = $this->comprar('2026-09-20');
        $this->assertSame('2026-10-01', $compra->fatura->due_date->toDateString());

        // Vence dia 20, fecha 7 dias antes (dia 13): a compra de 20/09 passa a ser da fatura de outubro? Não: fecha 13/10.
        $this->putJson("/api/cartoes/atualizar/{$this->cartao->id}", ['due_day' => 20])->assertOk();

        $compra->refresh()->load('fatura');
        $this->assertSame('2026-10-20', $compra->fatura->due_date->toDateString());
        $this->assertSame('2026-10-13', $compra->fatura->closing_date->toDateString());
        $this->assertSame(1, Fatura::where('card_id', $this->cartao->id)->count(), 'a fatura antiga vazia é removida');
    }

    #[Test]
    public function ajuste_manual_move_despesas_entre_a_fatura_e_a_seguinte(): void
    {
        // Fechamento 24/09 (fatura out) e 24/10 (fatura nov).
        $noDia25 = $this->comprar('2026-09-25');
        $noDia27 = $this->comprar('2026-09-27');
        $fatura = $this->comprar('2026-09-10')->fatura;

        $this->putJson("/api/faturas/{$fatura->id}/fechamento", ['closing_date' => '2026-09-26'])
            ->assertOk()->assertJsonPath('data.closing_manual', true);

        $this->assertSame($fatura->id, $noDia25->refresh()->invoice_id, 'o dia 25 agora cabe na fatura ajustada');
        $this->assertNotSame($fatura->id, $noDia27->refresh()->invoice_id);

        // Compra nova respeita o fechamento ajustado.
        $this->assertSame($fatura->id, $this->comprar('2026-09-26')->invoice_id);

        // Desfazer volta à regra.
        $this->putJson("/api/faturas/{$fatura->id}/fechamento", [])->assertOk()->assertJsonPath('data.closing_manual', false);
        $this->assertNotSame($fatura->id, $noDia25->refresh()->invoice_id);
    }

    #[Test]
    public function parcelas_acompanham_a_primeira_no_ajuste(): void
    {
        $parcelada = $this->comprar('2026-09-25', ['installment_total' => 3]);
        $this->comprar('2026-09-10'); // garante a fatura de outubro
        $fatura = Fatura::where('card_id', $this->cartao->id)->orderBy('reference_month')->first();

        $this->putJson("/api/faturas/{$fatura->id}/fechamento", ['closing_date' => '2026-09-26'])->assertOk();

        $meses = Transacao::where('installment_group', $parcelada->installment_group)->orderBy('installment_number')
            ->with('fatura')->get()->map(fn ($t) => $t->fatura->due_date->format('Y-m'))->all();

        $this->assertSame(['2026-10', '2026-11', '2026-12'], $meses);
    }

    #[Test]
    public function nao_deixa_a_fatura_da_frente_ficar_com_menos_de_3_dias(): void
    {
        $outubro = $this->comprar('2026-09-10')->fatura; // fecha 24/09, vence 01/10
        $novembro = $this->comprar('2026-10-10')->fatura; // fecha 25/10, vence 01/11

        // Novembro passa a fechar 27/09 (3 dias depois de 24/09: o mínimo permitido).
        $this->putJson("/api/faturas/{$novembro->id}/fechamento", ['closing_date' => '2026-09-27'])->assertOk();
        $this->putJson("/api/faturas/{$novembro->id}/fechamento", ['closing_date' => '2026-09-26'])->assertUnprocessable();

        // Outubro só pode ir até 3 dias antes do fechamento de novembro (27/09).
        $this->putJson("/api/faturas/{$outubro->id}/fechamento", ['closing_date' => '2026-09-25'])->assertUnprocessable();
        $this->putJson("/api/faturas/{$outubro->id}/fechamento", ['closing_date' => '2026-09-24'])->assertOk();

        // Fechar depois do vencimento nunca pode.
        $this->putJson("/api/faturas/{$novembro->id}/fechamento", ['closing_date' => '2026-11-01'])->assertUnprocessable();
    }

    #[Test]
    public function fatura_paga_nao_pode_ter_o_fechamento_ajustado(): void
    {
        $fatura = $this->comprar('2026-09-10')->fatura;
        $this->postJson("/api/faturas/{$fatura->id}/pagar", ['date' => '2026-10-01'])->assertOk();

        $this->putJson("/api/faturas/{$fatura->id}/fechamento", ['closing_date' => '2026-09-26'])->assertUnprocessable();
    }
}
