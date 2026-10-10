<?php

namespace Tests\Feature;

use App\Actions\Cartoes\CriarDespesaCartao;
use App\Actions\CriarRecorrenciaTransacao;
use App\Models\Cartao;
use App\Models\Conta;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class RelatorioCompromissosFuturosTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow('2026-10-10 09:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    private function transacao(Conta $conta, array $overrides = []): Transacao
    {
        return Transacao::create(array_merge([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => 'EXPENSE',
            'amount' => 100,
            'status' => 'PENDING',
            'due_date' => '2026-10-20',
            'description' => 'Conta',
        ], $overrides));
    }

    private function saldo(Conta $conta, float $valor): void
    {
        $this->transacao($conta, [
            'type' => 'INCOME', 'amount' => $valor, 'status' => 'PAID',
            'date' => '2026-01-01', 'due_date' => null, 'is_initial_balance' => true,
        ]);
    }

    private function relatorio(array $params = []): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/relatorios/compromissos-futuros?' . http_build_query(
            array_merge(['data_final' => '2026-12-31'], $params)
        ));
    }

    private function cartao(Conta $conta): Cartao
    {
        return Cartao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);
    }

    private function recorrencia(Conta $conta, array $extra = [])
    {
        return CriarRecorrenciaTransacao::executar($conta->user_id, array_merge([
            'account_id' => $conta->id,
            'default_status' => 'PENDING',
            'type' => 'EXPENSE',
            'description' => 'Aluguel',
            'amount' => 1200,
            'frequency' => 'MONTHLY',
            'interval' => 1,
            'day_of_month' => 15,
            'start_date' => '2026-10-15',
        ], $extra));
    }

    #[Test]
    public function projeta_saldo_mes_a_mes_com_pendentes_e_ignora_o_que_ja_foi_pago(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $this->saldo($conta, 3000);

        $this->transacao($conta, ['type' => 'INCOME', 'amount' => 5000, 'due_date' => '2026-11-05', 'description' => 'Salário']);
        $this->transacao($conta, ['type' => 'EXPENSE', 'amount' => 800, 'due_date' => '2026-10-20']);
        // Já pago: o saldo atual já reflete, não pode virar compromisso.
        $this->transacao($conta, ['type' => 'EXPENSE', 'amount' => 999, 'status' => 'PAID', 'date' => '2026-10-02', 'due_date' => '2026-10-02']);

        $resposta = $this->relatorio()->assertOk();

        $resposta->assertJsonPath('data.resumo.saldo_atual', 3000 - 999);
        $resposta->assertJsonPath('data.resumo.a_receber', 5000);
        $resposta->assertJsonPath('data.resumo.a_pagar', 800);
        $resposta->assertJsonPath('data.resumo.saldo_final', 3000 - 999 - 800 + 5000);
        $resposta->assertJsonCount(3, 'data.meses'); // out, nov, dez — mesmo dez sem eventos

        $meses = collect($resposta->json('data.meses'))->keyBy('mes');
        $this->assertEquals(2001 - 800, $meses['2026-10']['saldo_final']);
        $this->assertEquals(5000, $meses['2026-11']['entradas']);
        $this->assertEquals(2001 - 800 + 5000, $meses['2026-12']['saldo_final']); // mês vazio herda o saldo
    }

    #[Test]
    public function projeta_ocorrencias_futuras_de_recorrencia_sem_duplicar_as_ja_geradas(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $this->saldo($conta, 10000);

        $this->recorrencia($conta); // próxima: 15/10, depois 15/11, 15/12

        $resposta = $this->relatorio()->assertOk();

        $resposta->assertJsonCount(3, 'data.eventos');
        $resposta->assertJsonPath('data.resumo.a_pagar', 3600);
        $this->assertTrue(collect($resposta->json('data.eventos'))->every(fn ($e) => $e['projetado'] && $e['origem'] === 'RECORRENTE'));
    }

    #[Test]
    public function parcelas_do_cartao_compoem_uma_unica_saida_por_fatura(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $this->saldo($conta, 5000);
        $cartao = $this->cartao($conta);

        // R$ 1.200 em 4x: faturas de 20/10, 20/11, 20/12 e 20/01.
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Notebook', 'amount' => 1200, 'purchase_date' => '2026-10-05', 'installment_total' => 4,
        ]);
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Mercado', 'amount' => 200, 'purchase_date' => '2026-10-06',
        ]);

        $resposta = $this->relatorio()->assertOk();

        $faturas = collect($resposta->json('data.eventos'))->where('origem', 'FATURA')->values();

        $this->assertCount(3, $faturas); // out, nov, dez — jan fica fora do horizonte
        $this->assertEquals(500, $faturas[0]['valor']); // 300 parcela + 200 mercado
        $this->assertCount(2, $faturas[0]['itens']);
        $this->assertEquals(300, $faturas[1]['valor']);
        $this->assertEquals('2/4', $faturas[1]['itens'][0]['parcela']);

        // Só a fatura entra no caixa: nada de somar as compras de novo.
        $resposta->assertJsonPath('data.resumo.a_pagar', 500 + 300 + 300);
        $this->assertCount(3, $resposta->json('data.eventos'));
    }

    #[Test]
    public function recorrencia_no_cartao_cai_na_fatura_certa_junto_das_compras_existentes(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $this->saldo($conta, 5000);
        $cartao = $this->cartao($conta);

        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Mercado', 'amount' => 200, 'purchase_date' => '2026-10-24', // fecha dia 10 → fatura de 20/11
        ]);

        // Netflix todo dia 12: 12/10 (já fechou → fatura 20/11), 12/11 (→ 20/12).
        $this->recorrencia($conta, [
            'card_id' => $cartao->id, 'description' => 'Netflix', 'amount' => 55.9,
            'day_of_month' => 12, 'start_date' => '2026-10-12',
        ]);

        $resposta = $this->relatorio()->assertOk();
        $faturas = collect($resposta->json('data.eventos'))->where('origem', 'FATURA')->values();

        $this->assertCount(2, $faturas);
        $this->assertEquals('2026-11-20', $faturas[0]['data']);
        $this->assertEquals(255.9, $faturas[0]['valor']);
        $this->assertEquals('2026-12-20', $faturas[1]['data']);
        $this->assertEquals(55.9, $faturas[1]['valor']);
        $this->assertTrue($faturas[1]['projetado']); // fatura que ainda nem existe
    }

    #[Test]
    public function recorrencia_variavel_entra_sem_valor_e_so_vira_estimativa_quando_pedido(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $this->saldo($conta, 5000);

        $energia = $this->recorrencia($conta, ['description' => 'Energia', 'amount' => null]);

        foreach (['2026-07-15' => 180, '2026-08-15' => 200, '2026-09-15' => 220] as $data => $valor) {
            $this->transacao($conta, [
                'status' => 'PAID', 'amount' => $valor, 'date' => $data, 'due_date' => $data,
                'recurring_transaction_id' => $energia->id,
            ]);
        }

        $semEstimativa = $this->relatorio()->assertOk();
        $semEstimativa->assertJsonPath('data.resumo.a_pagar', 0);
        $semEstimativa->assertJsonPath('data.resumo.sem_valor', 3);
        $semEstimativa->assertJsonPath('data.eventos.0.valor', null);

        $comEstimativa = $this->relatorio(['estimar_variaveis' => 1])->assertOk();
        $evento = $comEstimativa->json('data.eventos.0');

        $this->assertTrue($evento['estimado']);
        $this->assertFalse($evento['sem_valor']);
        $this->assertGreaterThan(180, $evento['valor']);
        $this->assertLessThan(225, $evento['valor']);
        $comEstimativa->assertJsonPath('data.resumo.sem_valor', 0);
        $this->assertGreaterThan(0, $comEstimativa->json('data.resumo.estimado.a_pagar'));
    }

    #[Test]
    public function alerta_quando_o_saldo_fica_negativo_antes_da_entrada_prevista(): void
    {
        $conta = Conta::factory()->create(['name' => 'Corrente']);
        Sanctum::actingAs($conta->user);
        $this->saldo($conta, 1000);

        $this->transacao($conta, ['amount' => 1450, 'due_date' => '2026-10-15', 'description' => 'Aluguel']);
        $this->transacao($conta, ['type' => 'INCOME', 'amount' => 5000, 'due_date' => '2026-10-25', 'description' => 'Salário']);

        $resposta = $this->relatorio(['data_final' => '2026-10-31'])->assertOk();

        $resposta->assertJsonPath('data.alertas.0.data', '2026-10-15');
        $resposta->assertJsonPath('data.alertas.0.saldo', -450);
        $resposta->assertJsonPath('data.alertas.0.volta_ao_positivo_em', '2026-10-25');
        $resposta->assertJsonPath('data.alertas.0.evento.descricao', 'Aluguel');
        $resposta->assertJsonPath('data.resumo.menor_saldo.valor', -450);
    }

    #[Test]
    public function vencidos_pendentes_pesam_no_saldo_a_partir_de_hoje(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $this->saldo($conta, 1000);
        $this->transacao($conta, ['amount' => 300, 'due_date' => '2026-10-01', 'description' => 'Atrasada']);

        $resposta = $this->relatorio(['data_final' => '2026-10-31'])->assertOk();

        $resposta->assertJsonPath('data.eventos.0.atrasado', true);
        $resposta->assertJsonPath('data.eventos.0.data', '2026-10-10');
        $resposta->assertJsonPath('data.eventos.0.data_original', '2026-10-01');
        $resposta->assertJsonPath('data.resumo.atrasados.quantidade', 1);
        $resposta->assertJsonPath('data.resumo.saldo_final', 700);
    }

    #[Test]
    public function filtra_por_conta_e_calcula_o_saldo_so_das_contas_escolhidas(): void
    {
        $contaA = Conta::factory()->create();
        $contaB = Conta::factory()->create(['user_id' => $contaA->user_id]);
        Sanctum::actingAs($contaA->user);
        $this->saldo($contaA, 1000);
        $this->saldo($contaB, 9000);
        $this->transacao($contaA, ['amount' => 100]);
        $this->transacao($contaB, ['amount' => 500]);

        $resposta = $this->relatorio(['conta_ids' => [$contaA->id]])->assertOk();

        $resposta->assertJsonPath('data.resumo.saldo_atual', 1000);
        $resposta->assertJsonPath('data.resumo.a_pagar', 100);
    }

    #[Test]
    public function exige_data_final_futura(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->getJson('/api/relatorios/compromissos-futuros')->assertStatus(422);
        $this->relatorio(['data_final' => '2026-10-01'])->assertStatus(422);
    }

    #[Test]
    public function nao_enxerga_dados_de_outro_usuario(): void
    {
        $outra = Conta::factory()->create();
        $this->saldo($outra, 7000);
        $this->transacao($outra, ['amount' => 400]);

        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $resposta = $this->relatorio()->assertOk();

        $resposta->assertJsonPath('data.resumo.saldo_atual', 0);
        $resposta->assertJsonCount(0, 'data.eventos');
    }
}
