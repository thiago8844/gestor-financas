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

class ParcelasCartaoTest extends TestCase
{
    use RefreshDatabase;

    private Conta $conta;
    private Cartao $cartao;

    protected function setUp(): void
    {
        parent::setUp();

        $this->conta = Conta::factory()->create();
        Sanctum::actingAs($this->conta->user);

        // Fecha dia 24, vence dia 1: o dia 24 ainda entra na fatura que fecha em 24.
        $this->cartao = Cartao::create([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'name' => 'Cartão', 'closing_day' => 24, 'due_day' => 1, 'active' => true,
        ]);
    }

    private function comprar(array $extra = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/transacoes/cartao', array_merge([
            'card_id' => $this->cartao->id,
            'description' => 'Compra',
            'amount' => 1000,
            'purchase_date' => '2026-09-10',
            'installment_total' => 3,
        ], $extra));
    }

    /** @return array<int, float> */
    private function valoresDoGrupo(string $grupo): array
    {
        return Transacao::where('installment_group', $grupo)->orderBy('installment_number')
            ->pluck('amount')->map(fn ($v) => (float) $v)->all();
    }

    #[Test]
    public function modo_padrao_joga_o_resto_na_ultima_parcela(): void
    {
        $grupo = $this->comprar()->assertCreated()->json('installment_group');

        $this->assertSame([333.33, 333.33, 333.34], $this->valoresDoGrupo($grupo));
    }

    #[Test]
    public function modo_primeira_joga_o_resto_na_primeira_parcela(): void
    {
        $grupo = $this->comprar(['modo_centavos' => 'primeira'])->assertCreated()->json('installment_group');

        $this->assertSame([333.34, 333.33, 333.33], $this->valoresDoGrupo($grupo));
    }

    #[Test]
    public function modo_espalhar_distribui_centavos_entre_as_primeiras(): void
    {
        $grupo = $this->comprar(['amount' => 100.02, 'installment_total' => 4, 'modo_centavos' => 'espalhar'])
            ->assertCreated()->json('installment_group');

        $this->assertSame([25.01, 25.01, 25.0, 25.0], $this->valoresDoGrupo($grupo));
    }

    #[Test]
    public function aceita_valores_exatos_por_parcela_cada_um_na_sua_fatura(): void
    {
        $grupo = $this->comprar([
            'parcelas' => [['amount' => 333.34], ['amount' => 333.33], ['amount' => 333.33]],
        ])->assertCreated()->json('installment_group');

        $this->assertSame([333.34, 333.33, 333.33], $this->valoresDoGrupo($grupo));
        $this->assertSame(3, Transacao::where('installment_group', $grupo)->distinct('invoice_id')->count('invoice_id'));
    }

    #[Test]
    public function recusa_quando_soma_das_parcelas_nao_confere_com_o_total(): void
    {
        $this->comprar([
            'parcelas' => [['amount' => 333.33], ['amount' => 333.33], ['amount' => 333.33]],
        ])->assertStatus(422)->assertJsonValidationErrors('parcelas');

        $this->assertSame(0, Transacao::count());
    }

    #[Test]
    public function recusa_quantidade_de_parcelas_diferente_do_total(): void
    {
        $this->comprar([
            'parcelas' => [['amount' => 500], ['amount' => 500]],
        ])->assertStatus(422)->assertJsonValidationErrors('parcelas');
    }

    #[Test]
    public function recusa_modo_de_centavos_invalido(): void
    {
        $this->comprar(['modo_centavos' => 'aleatorio'])->assertStatus(422)->assertJsonValidationErrors('modo_centavos');
    }

    #[Test]
    public function compra_no_dia_do_fechamento_entra_na_fatura_que_fecha_e_a_do_dia_seguinte_vai_para_a_proxima(): void
    {
        $this->comprar(['purchase_date' => '2026-09-23', 'installment_total' => 1])->assertCreated();
        $this->comprar(['purchase_date' => '2026-09-24', 'installment_total' => 1])->assertCreated();
        $this->comprar(['purchase_date' => '2026-09-25', 'installment_total' => 1])->assertCreated();

        $fechaEm = fn (string $data) => Transacao::whereDate('purchase_date', $data)->first()->fatura->closing_date->toDateString();

        $this->assertSame('2026-09-24', $fechaEm('2026-09-23'));
        $this->assertSame('2026-09-24', $fechaEm('2026-09-24'));
        $this->assertSame('2026-10-24', $fechaEm('2026-09-25'));
        $this->assertSame(2, Fatura::where('card_id', $this->cartao->id)->count());
    }

    #[Test]
    public function fechamento_dia_31_em_fevereiro_fecha_no_ultimo_dia_do_mes(): void
    {
        $this->cartao->update(['closing_day' => 31, 'due_day' => 10]);

        $this->comprar(['purchase_date' => '2027-02-28', 'installment_total' => 1])->assertCreated();

        $fatura = Transacao::first()->fatura;
        $this->assertSame('2027-02-28', $fatura->closing_date->toDateString());
        $this->assertSame('2027-03-10', $fatura->due_date->toDateString());
    }

    #[Test]
    public function parcelas_atravessam_a_virada_do_ano_uma_por_fatura(): void
    {
        $grupo = $this->comprar(['purchase_date' => '2026-11-30', 'installment_total' => 3])->assertCreated()->json('installment_group');

        $vencimentos = Transacao::where('installment_group', $grupo)->orderBy('installment_number')
            ->get()->map(fn ($t) => $t->fatura->due_date->toDateString())->all();

        $this->assertSame(['2027-01-01', '2027-02-01', '2027-03-01'], $vencimentos);
    }

    #[Test]
    public function fatura_so_aparece_como_fechada_depois_do_dia_do_fechamento(): void
    {
        $this->comprar(['purchase_date' => '2026-09-10', 'installment_total' => 1])->assertCreated();

        $status = function (string $hoje) {
            \Carbon\Carbon::setTestNow($hoje);

            return $this->getJson("/api/cartoes/{$this->cartao->id}/faturas")->assertOk()->json('data.0.status');
        };

        try {
            $this->assertSame('ABERTA', $status('2026-09-24 15:00:00'));
            $this->assertSame('FECHADA', $status('2026-09-25 08:00:00'));
        } finally {
            \Carbon\Carbon::setTestNow();
        }
    }
}
