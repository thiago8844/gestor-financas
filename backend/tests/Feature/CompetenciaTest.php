<?php

namespace Tests\Feature;

use App\Actions\Cartoes\CriarDespesaCartao;
use App\Models\Cartao;
use App\Models\Conta;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Regime de competência: o que conta é o dia da compra/ganho (accrual_date), nunca o pagamento,
 * o vencimento ou a parcela. Compra parcelada entra inteira no mês em que foi feita.
 */
class CompetenciaTest extends TestCase
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

    private function resultado(string $regime, string $inicio = '2026-10-01', string $fim = '2026-10-31')
    {
        return $this->getJson('/api/relatorios/resultado-financeiro?' . http_build_query([
            'data_inicial' => $inicio, 'data_final' => $fim, 'regime' => $regime,
        ]));
    }

    private function analise(string $inicio = '2026-10-01', string $fim = '2026-10-31')
    {
        return $this->getJson('/api/relatorios/analise-gastos?' . http_build_query([
            'data_inicial' => $inicio, 'data_final' => $fim, 'base_data' => 'GASTO',
        ]));
    }

    private function lancar(array $dados): Transacao
    {
        return Transacao::create(array_merge([
            'user_id' => $this->conta->user_id, 'account_id' => $this->conta->id,
            'type' => 'EXPENSE', 'amount' => 10, 'status' => 'PAID',
        ], $dados));
    }

    #[Test]
    public function compra_a_vista_entra_na_competencia_do_mes_da_compra(): void
    {
        $this->lancar(['amount' => 10, 'date' => '2026-10-12']);

        $this->resultado('COMPETENCIA')->assertJsonPath('data.resumo.despesas', 10);
    }

    #[Test]
    public function compra_parcelada_no_cartao_entra_inteira_no_mes_da_compra(): void
    {
        // 500 em 5x comprados em outubro: nenhuma parcela vence em outubro (fecha 10, vence 20 → 1ª em novembro).
        CriarDespesaCartao::executar($this->conta->user_id, $this->cartao, [
            'description' => 'TV', 'amount' => 500, 'accrual_date' => '2026-10-15', 'installment_total' => 5,
        ]);

        $this->resultado('COMPETENCIA')->assertJsonPath('data.resumo.despesas', 500);
        $this->resultado('COMPETENCIA', '2026-11-01', '2026-11-30')->assertJsonPath('data.resumo.despesas', 0);
        $this->resultado('COMPETENCIA', '2027-03-01', '2027-03-31')->assertJsonPath('data.resumo.despesas', 0);
        $this->analise()->assertJsonPath('data.resumo.total', 500);
    }

    #[Test]
    public function compra_parcelada_na_conta_entra_inteira_no_mes_da_compra(): void
    {
        $parcelas = [];
        foreach (['2026-11-10', '2026-12-10', '2027-01-10'] as $vencimento) {
            $parcelas[] = ['amount' => 100, 'due_date' => $vencimento, 'status' => 'PENDING'];
        }

        $this->postJson('/api/transacoes/parceladas', [
            'account_id' => $this->conta->id, 'type' => 'EXPENSE', 'description' => 'Sofá',
            'amount' => 300, 'installment_total' => 3, 'accrual_date' => '2026-10-20', 'parcelas' => $parcelas,
        ])->assertCreated();

        $this->resultado('COMPETENCIA')->assertJsonPath('data.resumo.despesas', 300);
        $this->resultado('COMPETENCIA', '2026-11-01', '2027-01-31')->assertJsonPath('data.resumo.despesas', 0);
        $this->analise()->assertJsonPath('data.resumo.total', 300);
    }

    #[Test]
    public function pendente_conta_como_gasto_e_caixa_continua_so_com_o_pago(): void
    {
        $this->lancar(['status' => 'PENDING', 'amount' => 70, 'date' => null, 'due_date' => '2026-11-05', 'accrual_date' => '2026-10-28']);
        $this->lancar(['amount' => 30, 'date' => '2026-10-03']);

        $this->resultado('COMPETENCIA')->assertJsonPath('data.resumo.despesas', 100);
        $this->resultado('CAIXA')->assertJsonPath('data.resumo.despesas', 30);
    }

    #[Test]
    public function receita_entra_na_competencia_pela_data_do_ganho(): void
    {
        // Ganho em outubro, mas o dinheiro só cai em novembro.
        $this->lancar(['type' => 'INCOME', 'amount' => 800, 'status' => 'PENDING', 'date' => null, 'due_date' => '2026-11-05', 'accrual_date' => '2026-10-30']);

        $this->resultado('COMPETENCIA')->assertJsonPath('data.resumo.receitas', 800);
        $this->resultado('COMPETENCIA', '2026-11-01', '2026-11-30')->assertJsonPath('data.resumo.receitas', 0);
    }

    #[Test]
    public function serie_mensal_da_competencia_segue_a_data_da_compra(): void
    {
        CriarDespesaCartao::executar($this->conta->user_id, $this->cartao, [
            'description' => 'TV', 'amount' => 500, 'accrual_date' => '2026-10-15', 'installment_total' => 5,
        ]);

        $serie = $this->resultado('COMPETENCIA', '2026-10-01', '2027-03-31')->json('data.serie_mensal');

        $this->assertCount(1, $serie);
        $this->assertSame('2026-10-01', $serie[0]['periodo']);
        $this->assertEquals(500, $serie[0]['despesas']);
    }

    #[Test]
    public function todo_lancamento_nasce_com_data_de_competencia(): void
    {
        $avista = $this->lancar(['date' => '2026-10-12']);
        $pendente = $this->lancar(['status' => 'PENDING', 'date' => null, 'due_date' => '2026-10-25']);
        $receita = $this->lancar(['type' => 'INCOME', 'date' => '2026-10-02']);

        $this->assertSame('2026-10-12', $avista->fresh()->accrual_date->toDateString());
        $this->assertSame('2026-10-25', $pendente->fresh()->accrual_date->toDateString());
        $this->assertSame('2026-10-02', $receita->fresh()->accrual_date->toDateString());
    }

    #[Test]
    public function formulario_pode_informar_a_data_da_compra_na_conta(): void
    {
        $this->postJson('/api/transacoes/criar', [
            'account_id' => $this->conta->id, 'type' => 'EXPENSE', 'amount' => 50, 'paid' => true,
            'status' => 'PAID', 'date' => '2026-11-03', 'accrual_date' => '2026-10-29',
        ])->assertCreated();

        $this->assertSame('2026-10-29', Transacao::first()->accrual_date->toDateString());
    }

    #[Test]
    public function parcelas_na_conta_sem_data_da_compra_usam_a_primeira_data_do_grupo(): void
    {
        $this->postJson('/api/transacoes/parceladas', [
            'account_id' => $this->conta->id, 'type' => 'EXPENSE', 'description' => 'Sofá',
            'amount' => 200, 'installment_total' => 2,
            'parcelas' => [
                ['amount' => 100, 'due_date' => '2026-10-10', 'status' => 'PENDING'],
                ['amount' => 100, 'due_date' => '2026-11-10', 'status' => 'PENDING'],
            ],
        ])->assertCreated();

        $this->assertSame(['2026-10-10'], Transacao::all()->map(fn ($t) => $t->accrual_date->toDateString())->unique()->values()->all());
    }
}
