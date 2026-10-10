<?php

namespace Tests\Feature;

use App\Actions\Cartoes\CriarDespesaCartao;
use App\Actions\CriarRecorrenciaTransacao;
use App\Actions\GerarTransacoesRecorrentes;
use App\Actions\Transferencias\SalvarTransferencia;
use App\Models\Cartao;
use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class SimuladorFinanceiroTest extends TestCase
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

    // -=-=-=- HELPERS -=-=-=-

    private function conta(?Conta $mesmoUsuario = null, string $nome = 'Conta'): Conta
    {
        $conta = $mesmoUsuario
            ? Conta::factory()->create(['user_id' => $mesmoUsuario->user_id, 'name' => $nome])
            : Conta::factory()->create(['name' => $nome]);

        Sanctum::actingAs($conta->user);

        return $conta;
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
            'date' => '2024-01-01', 'due_date' => null, 'is_initial_balance' => true,
        ]);
    }

    private function categoria(Conta $conta, string $nome): Categoria
    {
        return Categoria::create(['user_id' => $conta->user_id, 'name' => $nome]);
    }

    /**
     * Histórico pago de uma categoria: um lançamento por mês, do mês mais ANTIGO ao mais recente,
     * terminando em setembro/2026 (mês anterior a "hoje").
     */
    private function historico(Conta $conta, Categoria $categoria, array $valores, int $dia = 5, string $tipo = 'EXPENSE'): void
    {
        $mes = Carbon::parse('2026-09-01')->subMonthsNoOverflow(count($valores) - 1);

        foreach ($valores as $valor) {
            if ($valor > 0) {
                $data = $mes->copy()->day($dia)->toDateString();
                $this->transacao($conta, [
                    'type' => $tipo, 'amount' => $valor, 'status' => 'PAID', 'date' => $data, 'due_date' => $data,
                    'category_id' => $categoria->id, 'description' => $categoria->name,
                ]);
            }
            $mes->addMonthNoOverflow();
        }
    }

    private function cartao(Conta $conta, array $extra = []): Cartao
    {
        return Cartao::create(array_merge([
            'user_id' => $conta->user_id, 'account_id' => $conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ], $extra));
    }

    private function simular(array $params = []): TestResponse
    {
        return $this->postJson('/api/relatorios/simulador-financeiro', array_merge(['data_final' => '2026-12-31'], $params));
    }

    private function mes(TestResponse $resposta, string $mes, string $cenario = 'personalizado'): array
    {
        return collect($resposta->json("data.cenarios.{$cenario}.meses"))->firstWhere('mes', $mes);
    }

    private function categoriaDaResposta(TestResponse $resposta, string $nome): array
    {
        return collect($resposta->json('data.categorias'))->firstWhere('categoria', $nome);
    }

    private function estimadosDaCategoria(TestResponse $resposta, string $nome, ?string $mes = null): float
    {
        $total = 0.0;

        foreach ($resposta->json('data.eventos') as $evento) {
            $itens = $evento['natureza'] === 'FATURA' ? $evento['itens'] : [$evento];
            foreach ($itens as $item) {
                $data = $item['data_compra'] ?? $item['data'];
                if (($item['natureza'] ?? null) === 'ESTIMADO' && $item['categoria'] === $nome && ($mes === null || str_starts_with($data, $mes))) {
                    $total += $item['valor'];
                }
            }
        }

        return round($total, 2);
    }

    // -=-=-=- PROJEÇÃO BÁSICA -=-=-=-

    #[Test]
    public function projecao_simples_com_saldo_receita_e_despesa_conhecidas(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 3000);
        $this->transacao($conta, ['type' => 'INCOME', 'amount' => 5000, 'due_date' => '2026-11-05', 'description' => 'Salário']);
        $this->transacao($conta, ['amount' => 800, 'due_date' => '2026-10-20']);

        $resposta = $this->simular()->assertOk();

        $resposta->assertJsonPath('data.cenarios.base.resumo.saldo_atual', 3000);
        $resposta->assertJsonPath('data.cenarios.base.resumo.saldo_final', 7200);
        $resposta->assertJsonPath('data.cenarios.base.resumo.receitas.conhecidas', 5000);
        $resposta->assertJsonPath('data.cenarios.base.resumo.despesas.conhecidas', 800);
        $resposta->assertJsonPath('data.cenarios.base.resumo.despesas.estimadas', 0);
        $resposta->assertJsonCount(3, 'data.cenarios.base.meses');
        $this->assertEquals(2200, $this->mes($resposta, '2026-10')['saldo_final']);
    }

    #[Test]
    public function saldo_inicial_nunca_e_tratado_como_receita_nem_entra_nas_estimativas(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 50000);
        // Saldo inicial lançado DENTRO da janela do histórico — continua não sendo receita.
        $outra = $this->conta($conta, 'Poupança');
        $this->transacao($outra, ['type' => 'INCOME', 'amount' => 20000, 'status' => 'PAID', 'date' => '2026-06-01', 'is_initial_balance' => true]);

        $resposta = $this->simular()->assertOk();

        $this->assertEmpty(collect($resposta->json('data.categorias'))->where('tipo', 'INCOME'));
        $this->assertEquals(0, collect($resposta->json('data.historico'))->sum('receitas'));
        $resposta->assertJsonPath('data.cenarios.base.resumo.receitas.total', 0);
        $resposta->assertJsonPath('data.cenarios.base.resumo.saldo_atual', 70000);
    }

    #[Test]
    public function alterar_o_periodo_muda_os_meses_projetados(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);

        $this->simular(['data_final' => '2026-12-31'])->assertOk()->assertJsonCount(3, 'data.cenarios.base.meses');
        $this->simular(['data_final' => '2027-10-31'])->assertOk()->assertJsonCount(13, 'data.cenarios.base.meses');
        $this->simular(['data_final' => '2026-10-31'])->assertOk()->assertJsonCount(1, 'data.cenarios.base.meses');
    }

    // -=-=-=- ESTIMATIVAS PELO HISTÓRICO -=-=-=-

    #[Test]
    public function estima_despesa_variavel_ainda_nao_cadastrada_a_partir_do_historico(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $mercado = $this->categoria($conta, 'Supermercado');
        $this->historico($conta, $mercado, [650, 720, 680, 710, 690, 740]);

        $resposta = $this->simular()->assertOk();
        $categoria = $this->categoriaDaResposta($resposta, 'Supermercado');

        $this->assertSame('PROJETADA', $categoria['status']);
        $this->assertTrue($categoria['projetada']);
        $this->assertEqualsWithDelta(700, $categoria['estimativa_mensal'], 30);
        $this->assertContains($categoria['confianca'], ['ALTA', 'MEDIA']);
        $this->assertSame('INICIO', $categoria['perfil']['padrao']);

        // Mês cheio: a estimativa inteira vira lançamentos previstos.
        $this->assertEqualsWithDelta($categoria['estimativa_mensal'], $this->estimadosDaCategoria($resposta, 'Supermercado', '2026-11'), 15);
        // Mês corrente: o gasto costuma ser no começo do mês e já passou — só sobra uma fração pequena.
        $this->assertLessThan(150, $this->estimadosDaCategoria($resposta, 'Supermercado', '2026-10'));

        // Estimativas nunca caem no passado.
        foreach ($resposta->json('data.eventos') as $evento) {
            $this->assertGreaterThanOrEqual('2026-10-10', $evento['data']);
        }
    }

    #[Test]
    public function estimativas_desligadas_usam_so_compromissos_conhecidos(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $this->historico($conta, $this->categoria($conta, 'Supermercado'), [650, 720, 680, 710, 690, 740]);

        $resposta = $this->simular(['estimar_variaveis' => false])->assertOk();

        $resposta->assertJsonPath('data.cenarios.base.resumo.despesas.estimadas', 0);
        $this->assertEquals($resposta->json('data.cenarios.base.resumo.saldo_atual'), $resposta->json('data.cenarios.base.resumo.saldo_final'));
        $this->assertFalse($this->categoriaDaResposta($resposta, 'Supermercado')['projetada']);

        // Controle secundário: só despesas desligadas.
        $this->simular(['prever_despesas_variaveis' => false])->assertOk()
            ->assertJsonPath('data.cenarios.base.resumo.despesas.estimadas', 0);
    }

    #[Test]
    public function historico_insuficiente_nao_inventa_estimativa(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $this->historico($conta, $this->categoria($conta, 'Manutenção moto'), [0, 0, 0, 0, 0, 900]);

        $resposta = $this->simular()->assertOk();
        $categoria = $this->categoriaDaResposta($resposta, 'Manutenção moto');

        $this->assertSame('INSUFICIENTE', $categoria['status']);
        $this->assertNull($categoria['estimativa_mensal']);
        $this->assertFalse($categoria['projetada']);
        $this->assertEquals(0, $this->estimadosDaCategoria($resposta, 'Manutenção moto'));
    }

    #[Test]
    public function receita_eventual_nao_e_projetada(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $this->historico($conta, $this->categoria($conta, 'Venda de bens'), [0, 3000, 0, 0, 2500, 0], 5, 'INCOME');

        $resposta = $this->simular()->assertOk();

        $this->assertSame('EVENTUAL', $this->categoriaDaResposta($resposta, 'Venda de bens')['status']);
        $resposta->assertJsonPath('data.cenarios.base.resumo.receitas.estimadas', 0);
    }

    #[Test]
    public function receita_variavel_regular_e_projetada(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $this->historico($conta, $this->categoria($conta, 'Freelas'), [1000, 1100, 900, 1050, 1000, 980], 20, 'INCOME');

        $resposta = $this->simular()->assertOk();

        $this->assertSame('PROJETADA', $this->categoriaDaResposta($resposta, 'Freelas')['status']);
        $this->assertGreaterThan(1500, $resposta->json('data.cenarios.base.resumo.receitas.estimadas'));
        // Sem regras de receita, a desligar só receitas mantém as despesas.
        $this->simular(['prever_receitas_variaveis' => false])->assertOk()
            ->assertJsonPath('data.cenarios.base.resumo.receitas.estimadas', 0);
    }

    #[Test]
    public function gasto_extraordinario_nao_distorce_a_previsao(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $this->historico($conta, $this->categoria($conta, 'Farmácia'), [300, 350, 320, 1800, 340, 360]);

        $resposta = $this->simular()->assertOk();
        $categoria = $this->categoriaDaResposta($resposta, 'Farmácia');

        $this->assertLessThan(400, $categoria['estimativa_mensal']);
        $this->assertGreaterThan(300, $categoria['estimativa_mensal']);
        // O mês de R$ 1.800 é identificado e fica fora da média.
        $this->assertCount(1, $categoria['extraordinarios']);
        $this->assertEquals(1800, collect($categoria['historico'])->firstWhere('mes', '2026-07')['extraordinario']);
    }

    #[Test]
    public function heranca_no_meio_das_receitas_comuns_nao_vira_receita_mensal(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $outras = $this->categoria($conta, 'Outras receitas');
        // Salário lançado à mão todo mês na mesma categoria em que caiu a herança.
        $this->historico($conta, $outras, array_fill(0, 8, 5000), 5, 'INCOME');
        $this->transacao($conta, ['type' => 'INCOME', 'amount' => 200000, 'status' => 'PAID', 'date' => '2026-06-18', 'due_date' => '2026-06-18', 'category_id' => $outras->id, 'description' => 'Herança']);

        $resposta = $this->simular()->assertOk();
        $categoria = $this->categoriaDaResposta($resposta, 'Outras receitas');

        $this->assertEqualsWithDelta(5000, $categoria['estimativa_mensal'], 1);
        $this->assertCount(1, $categoria['extraordinarios']);
        $this->assertSame('Herança', $categoria['extraordinarios'][0]['descricao']);
        // Nenhum mês projetado espera dinheiro perto da herança.
        foreach ($resposta->json('data.cenarios.base.meses') as $mes) {
            $this->assertLessThan(6000, $mes['receitas']['estimadas']);
        }
    }

    #[Test]
    public function heranca_em_categoria_propria_nao_e_projetada(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $this->historico($conta, $this->categoria($conta, 'Salário'), array_fill(0, 8, 5000), 5, 'INCOME');
        $this->historico($conta, $this->categoria($conta, 'Mercado'), array_fill(0, 8, 600));
        $heranca = $this->categoria($conta, 'Herança');
        $this->transacao($conta, ['type' => 'INCOME', 'amount' => 150000, 'status' => 'PAID', 'date' => '2026-05-03', 'due_date' => '2026-05-03', 'category_id' => $heranca->id]);

        $resposta = $this->simular()->assertOk();
        $categoria = $this->categoriaDaResposta($resposta, 'Herança');

        $this->assertFalse($categoria['projetada']);
        $this->assertNotEmpty($categoria['extraordinarios']);
        // Só os salários: o de outubro (dia 5) já passou; novembro e dezembro inteiros.
        $this->assertEquals(10000, $resposta->json('data.cenarios.base.resumo.receitas.estimadas'));
    }

    #[Test]
    public function valor_alto_que_se_repete_todo_mes_e_padrao_e_nao_extraordinario(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        // Fazenda: leite toda semana (valores pequenos) e venda de gado todo mês (valores enormes).
        $leite = $this->categoria($conta, 'Venda de leite');
        foreach ([3, 10, 17, 24] as $dia) {
            $this->historico($conta, $leite, array_fill(0, 8, 2000), $dia, 'INCOME');
        }
        $this->historico($conta, $this->categoria($conta, 'Venda de gado'), [99000, 151000, 116000, 155000, 108000, 103000, 168000, 121000], 15, 'INCOME');

        $resposta = $this->simular()->assertOk();
        $gado = $this->categoriaDaResposta($resposta, 'Venda de gado');

        $this->assertSame('PROJETADA', $gado['status']);
        $this->assertEmpty($gado['extraordinarios']);
        $this->assertGreaterThan(100000, $gado['estimativa_mensal']);
    }

    #[Test]
    public function receita_trimestral_entra_so_nos_meses_em_que_deve_ocorrer(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $graos = $this->categoria($conta, 'Venda de grãos');
        // jan, abr, jul (e out/25): próxima em outubro/26, depois janeiro/27.
        $this->historico($conta, $graos, [17000, 0, 0, 15700, 0, 0, 15600, 0, 0, 21000, 0, 0], 20, 'INCOME');

        $resposta = $this->simular(['data_final' => '2027-01-31'])->assertOk();
        $meses = collect($resposta->json('data.cenarios.base.meses'))->keyBy('mes');

        $this->assertSame('periodica', $this->categoriaDaResposta($resposta, 'Venda de grãos')['metodo']);
        $this->assertGreaterThan(14000, $meses['2026-10']['receitas']['estimadas']);
        $this->assertEquals(0, $meses['2026-11']['receitas']['estimadas']);
        $this->assertEquals(0, $meses['2026-12']['receitas']['estimadas']);
        $this->assertGreaterThan(14000, $meses['2027-01']['receitas']['estimadas']);
    }

    #[Test]
    public function compra_extraordinaria_ja_cadastrada_nao_zera_a_previsao_da_categoria(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 100000);
        $transporte = $this->categoria($conta, 'Transporte');
        $this->historico($conta, $transporte, array_fill(0, 8, 300));
        $this->historico($conta, $this->categoria($conta, 'Mercado'), array_fill(0, 8, 700));
        // Carro comprado em dezembro, já agendado: é compromisso real, mas não "consome" a gasolina.
        $this->transacao($conta, ['amount' => 45000, 'due_date' => '2026-12-05', 'category_id' => $transporte->id, 'description' => 'Carro']);

        $resposta = $this->simular()->assertOk();

        $this->assertEquals(300, $this->estimadosDaCategoria($resposta, 'Transporte', '2026-12'));
        $this->assertTrue(collect($resposta->json('data.eventos'))->contains(fn ($e) => $e['descricao'] === 'Carro' && $e['valor'] == 45000));
        $this->assertTrue($this->categoriaDaResposta($resposta, 'Transporte')['extraordinarios'][0]['futuro']);
    }

    #[Test]
    public function previsao_e_reconciliada_com_o_que_ja_esta_cadastrado(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $mercado = $this->categoria($conta, 'Supermercado');
        $this->historico($conta, $mercado, array_fill(0, 8, 700));

        // Compra futura já cadastrada em novembro.
        $this->transacao($conta, ['amount' => 300, 'due_date' => '2026-11-03', 'category_id' => $mercado->id, 'description' => 'Compra do mês']);

        $resposta = $this->simular()->assertOk();
        $novembro = collect($this->categoriaDaResposta($resposta, 'Supermercado')['projecao'])->firstWhere('mes', '2026-11');

        $this->assertEquals(700, $novembro['automatico']);
        $this->assertEquals(300, $novembro['conhecido']);
        $this->assertEquals(400, $novembro['adicional_base']);
        $this->assertEquals(400, $this->estimadosDaCategoria($resposta, 'Supermercado', '2026-11'));

        // No caixa de novembro: 300 conhecidos + 400 estimados = 700, não 1.000.
        $categoriaMes = collect($resposta->json('data.categorias_mes'))->firstWhere('categoria', 'Supermercado');
        $mesCaixa = collect($categoriaMes['meses'])->firstWhere('mes', '2026-11');
        $this->assertEquals(700, $mesCaixa['conhecido'] + $mesCaixa['estimado']);
    }

    #[Test]
    public function gasto_ja_feito_no_mes_corrente_reduz_o_que_falta_estimar(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $mercado = $this->categoria($conta, 'Supermercado');
        // Gasto espalhado no mês (dia 20).
        $this->historico($conta, $mercado, array_fill(0, 8, 700), 20);
        // Já pago neste mês: está no saldo, não pode ser previsto de novo.
        $this->transacao($conta, ['amount' => 650, 'status' => 'PAID', 'date' => '2026-10-02', 'due_date' => '2026-10-02', 'category_id' => $mercado->id]);

        $resposta = $this->simular()->assertOk();

        $this->assertEquals(50, $this->estimadosDaCategoria($resposta, 'Supermercado', '2026-10'));
    }

    #[Test]
    public function recorrencia_sem_valor_e_estimada_com_a_mesma_regra_dos_compromissos_futuros(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 5000);
        $luz = CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE',
            'description' => 'Conta de luz', 'amount' => null, 'frequency' => 'MONTHLY', 'interval' => 1,
            'day_of_month' => 15, 'start_date' => '2026-10-15',
        ]);
        foreach (['2026-07-15' => 180, '2026-08-15' => 200, '2026-09-15' => 220] as $data => $valor) {
            $this->transacao($conta, ['amount' => $valor, 'status' => 'PAID', 'date' => $data, 'due_date' => $data, 'recurring_transaction_id' => $luz->id]);
        }

        $ligada = $this->simular()->assertOk();
        $ocorrencias = collect($ligada->json('data.eventos'))->where('recorrencia_id', $luz->id);
        $this->assertCount(3, $ocorrencias);
        $this->assertTrue($ocorrencias->every(fn ($e) => $e['natureza'] === 'ESTIMADO' && $e['valor'] > 0));
        // A categoria conhece o histórico da recorrência, mas desconta as ocorrências projetadas:
        // nada (ou quase nada, só a diferença entre os dois estimadores) é previsto a mais.
        $adicional = collect($ligada->json('data.eventos'))->where('origem', 'ESTIMADO')->sum('valor');
        $this->assertLessThan(15, $adicional);

        $desligada = $this->simular(['estimar_variaveis' => false])->assertOk();
        $this->assertTrue(collect($desligada->json('data.eventos'))->where('recorrencia_id', $luz->id)->every(fn ($e) => $e['valor'] === null));
        $desligada->assertJsonPath('data.cenarios.base.resumo.saldo_final', 5000 - 600);
    }

    #[Test]
    public function recorrencia_ja_materializada_nao_e_duplicada(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE', 'description' => 'Aluguel',
            'amount' => 1200, 'frequency' => 'MONTHLY', 'interval' => 1, 'day_of_month' => 15, 'start_date' => '2026-10-15',
        ]);
        // O job gera a ocorrência de outubro: agora ela é um lançamento pendente.
        Carbon::setTestNow('2026-10-15 09:00:00');
        app(GerarTransacoesRecorrentes::class)->executar();
        Carbon::setTestNow('2026-10-10 09:00:00');

        $resposta = $this->simular()->assertOk();

        $resposta->assertJsonPath('data.cenarios.base.resumo.despesas.total', 3600);
        $this->assertCount(3, collect($resposta->json('data.eventos'))->where('descricao', 'Aluguel'));
    }

    #[Test]
    public function salario_lancado_a_mao_e_depois_virou_recorrencia_nao_e_contado_duas_vezes(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $salario = $this->categoria($conta, 'Salário');
        // Meses digitados à mão, SEM vínculo com a recorrência criada depois.
        $this->historico($conta, $salario, array_fill(0, 12, 2500), 1, 'INCOME');
        CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'category_id' => $salario->id, 'default_status' => 'PENDING', 'type' => 'INCOME',
            'description' => 'Salário', 'amount' => 2500, 'frequency' => 'MONTHLY', 'interval' => 1, 'day_of_month' => 1, 'start_date' => '2026-11-01',
        ]);

        $resposta = $this->simular()->assertOk();

        // Nov e dez: só a recorrência (2 × 2.500). Outubro (dia 1) já passou.
        $resposta->assertJsonPath('data.cenarios.base.resumo.receitas.total', 5000);
        $resposta->assertJsonPath('data.cenarios.base.resumo.receitas.estimadas', 0);
        $novembro = collect($this->categoriaDaResposta($resposta, 'Salário')['projecao'])->firstWhere('mes', '2026-11');
        $this->assertEquals(2500, $novembro['conhecido']);
        $this->assertEquals(0, $novembro['adicional_base']);

        // Cancelar a recorrência na simulação não faz a estimativa "devolver" o salário.
        $recorrenciaId = collect($resposta->json('data.eventos'))->firstWhere('descricao', 'Salário')['recorrencia_id'];
        $cancelada = $this->simular(['cenario' => ['ajustes' => [
            ['id' => 'c', 'alvo' => 'RECORRENCIA', 'recorrencia_id' => $recorrenciaId, 'modo' => 'PERCENTUAL', 'valor' => -100],
        ]]])->assertOk();
        $cancelada->assertJsonPath('data.cenarios.personalizado.resumo.receitas.total', 0);
    }

    #[Test]
    public function ajuste_da_categoria_alcanca_a_recorrencia_dela_sem_somar_duas_vezes(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $moradia = $this->categoria($conta, 'Moradia');
        $this->historico($conta, $moradia, array_fill(0, 8, 1000), 10);
        CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'category_id' => $moradia->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE',
            'description' => 'Aluguel', 'amount' => 800, 'frequency' => 'MONTHLY', 'interval' => 1, 'day_of_month' => 10, 'start_date' => '2026-11-10',
        ]);

        $base = $this->simular()->assertOk();
        // Moradia: 1.000/mês no total = 800 de aluguel (recorrência) + 200 de resto.
        $this->assertEquals(200, $this->estimadosDaCategoria($base, 'Moradia', '2026-11'));

        $reduzida = $this->simular(['cenario' => ['ajustes' => [
            ['id' => 'm', 'alvo' => 'CATEGORIA', 'tipo' => 'EXPENSE', 'categoria_id' => $moradia->id, 'modo' => 'PERCENTUAL', 'valor' => -20],
        ]]])->assertOk();
        $novembro = collect($reduzida->json('data.categorias_mes'))->firstWhere('categoria', 'Moradia')['meses'];
        $nov = collect($novembro)->firstWhere('mes', '2026-11');
        // 20% a menos no total: 640 de aluguel + 160 de resto = 800.
        $this->assertEquals(800, round($nov['conhecido'] + $nov['estimado'], 2));
    }

    // -=-=-=- CARTÕES -=-=-=-

    #[Test]
    public function compra_no_cartao_antes_e_depois_do_fechamento_cai_na_fatura_certa(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $cartao = $this->cartao($conta); // fecha dia 10, vence dia 20

        $resposta = $this->simular(['cenario' => ['eventos' => [
            ['id' => 'a', 'descricao' => 'Antes do fechamento', 'tipo' => 'EXPENSE', 'valor' => 100, 'data' => '2026-10-10', 'cartao_id' => $cartao->id],
            ['id' => 'b', 'descricao' => 'Depois do fechamento', 'tipo' => 'EXPENSE', 'valor' => 250, 'data' => '2026-10-11', 'cartao_id' => $cartao->id],
        ]]])->assertOk();

        $faturas = collect($resposta->json('data.eventos'))->where('natureza', 'FATURA')->keyBy('data');
        $this->assertEquals(100, $faturas['2026-10-20']['valor']);
        $this->assertEquals(250, $faturas['2026-11-20']['valor']);
        // Nada saiu do caixa na data da compra.
        $this->assertEmpty(collect($resposta->json('data.eventos'))->where('origem', 'HIPOTETICO'));
    }

    #[Test]
    public function compras_estimadas_no_cartao_respeitam_o_ciclo_e_somam_na_fatura_existente(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $cartao = $this->cartao($conta);
        $mercado = $this->categoria($conta, 'Supermercado');

        // Histórico de compras no cartão sempre no dia 15 (depois do fechamento).
        foreach (range(1, 6) as $i) {
            $data = Carbon::parse('2026-10-15')->subMonthsNoOverflow($i);
            CriarDespesaCartao::executar($conta->user_id, $cartao, [
                'description' => 'Mercado', 'amount' => 500, 'purchase_date' => $data->toDateString(), 'category_id' => $mercado->id,
            ]);
        }
        Transacao::where('card_id', $cartao->id)->update(['status' => 'PAID']);
        // Compra real já na fatura de novembro.
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Farmácia', 'amount' => 80, 'purchase_date' => '2026-10-11',
        ]);

        $resposta = $this->simular(['data_final' => '2027-01-31'])->assertOk();
        $faturas = collect($resposta->json('data.eventos'))->where('natureza', 'FATURA')->keyBy('data');

        // Compra estimada em 15/10 → ciclo que fecha em 10/11 → fatura de 20/11, junto da compra real.
        // (Um pouco menos de 500: parte do perfil do mês fica na faixa de 1-10/10, que já passou.)
        $this->assertEquals(80, $faturas['2026-11-20']['composicao']['conhecido']);
        $this->assertEqualsWithDelta(475, $faturas['2026-11-20']['composicao']['estimado'], 25);
        $this->assertEquals(1, collect($resposta->json('data.eventos'))->where('natureza', 'FATURA')->where('data', '2026-11-20')->count());
        $this->assertEqualsWithDelta(500, $faturas['2026-12-20']['composicao']['estimado'], 1);
        // A fatura de 20/10 (já fechada em 10/10) não recebe compra estimada.
        $this->assertFalse(isset($faturas['2026-10-20']) && $faturas['2026-10-20']['composicao']['estimado'] > 0);
    }

    #[Test]
    public function parcelas_hipoteticas_no_cartao_vao_uma_por_fatura_com_arredondamento_fechado(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $cartao = $this->cartao($conta);

        $resposta = $this->simular(['data_final' => '2027-02-28', 'cenario' => ['eventos' => [
            ['id' => 'pc', 'descricao' => 'Computador', 'tipo' => 'EXPENSE', 'valor' => 1000, 'data' => '2026-10-12', 'cartao_id' => $cartao->id, 'parcelas' => 3],
        ]]])->assertOk();

        $faturas = collect($resposta->json('data.eventos'))->where('natureza', 'FATURA')->pluck('valor', 'data');
        $this->assertEquals(['2026-11-20' => 333.33, '2026-12-20' => 333.33, '2027-01-20' => 333.34], $faturas->all());
        $resposta->assertJsonPath('data.cenarios.personalizado.resumo.despesas.hipoteticas', 1000);
        $resposta->assertJsonPath('data.cenarios.personalizado.resumo.saldo_final', 9000);
    }

    #[Test]
    public function compra_parcelada_real_nao_duplica_entre_compra_parcela_e_fatura(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 5000);
        $cartao = $this->cartao($conta);
        $eletronicos = $this->categoria($conta, 'Eletrônicos');

        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Notebook', 'amount' => 1200, 'purchase_date' => '2026-10-05', 'installment_total' => 4, 'category_id' => $eletronicos->id,
        ]);

        $resposta = $this->simular()->assertOk();
        $eventos = collect($resposta->json('data.eventos'));

        // Três faturas no horizonte (out, nov, dez), cada uma com uma parcela de 300.
        $this->assertCount(3, $eventos);
        $this->assertTrue($eventos->every(fn ($e) => $e['natureza'] === 'FATURA' && $e['valor'] == 300));
        $resposta->assertJsonPath('data.cenarios.base.resumo.despesas.total', 900);
        // Parcelas não viram "padrão de consumo" a ser previsto.
        $this->assertEmpty($resposta->json('data.categorias'));
        // A visão por categoria soma o mesmo que o caixa.
        $this->assertEquals(900, collect($resposta->json('data.categorias_mes'))->sum('total'));
    }

    // -=-=-=- CENÁRIOS -=-=-=-

    #[Test]
    public function ajustes_percentuais_e_absolutos_por_categoria(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $mercado = $this->categoria($conta, 'Supermercado');
        $this->historico($conta, $mercado, array_fill(0, 8, 700));

        $percentual = $this->simular(['cenario' => ['ajustes' => [
            ['id' => 'x', 'alvo' => 'CATEGORIA', 'tipo' => 'EXPENSE', 'categoria_id' => $mercado->id, 'modo' => 'PERCENTUAL', 'valor' => -20],
        ]]])->assertOk();
        $this->assertEquals(560, $this->estimadosDaCategoria($percentual, 'Supermercado', '2026-11'));
        $this->assertEquals(700, $this->estimadosDaCategoria($percentual, 'Supermercado', '2026-11') / 0.8);

        $definido = $this->simular(['cenario' => ['ajustes' => [
            ['id' => 'x', 'alvo' => 'CATEGORIA', 'tipo' => 'EXPENSE', 'categoria_id' => $mercado->id, 'modo' => 'DEFINIR', 'valor' => 500, 'mes_inicio' => '2026-12'],
        ]]])->assertOk();
        $this->assertEquals(700, $this->estimadosDaCategoria($definido, 'Supermercado', '2026-11'));
        $this->assertEquals(500, $this->estimadosDaCategoria($definido, 'Supermercado', '2026-12'));

        $economia = $this->simular(['cenario' => ['ajustes' => [
            ['id' => 'e', 'rotulo' => 'Economizar R$ 200/mês', 'alvo' => 'DESPESAS_ESTIMADAS', 'modo' => 'DELTA', 'valor' => -200, 'mes_inicio' => '2026-11'],
        ]]])->assertOk();
        $this->assertEquals(500, $this->estimadosDaCategoria($economia, 'Supermercado', '2026-11'));
        $impacto = collect($economia->json('data.impactos'))->firstWhere('id', 'e');
        $this->assertEquals(400, $impacto['impacto_saldo_final']);
    }

    #[Test]
    public function previsao_manual_para_categoria_sem_historico(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $academia = $this->categoria($conta, 'Academia');

        $resposta = $this->simular(['cenario' => ['ajustes' => [
            ['id' => 'm', 'alvo' => 'CATEGORIA', 'tipo' => 'EXPENSE', 'categoria_id' => $academia->id, 'modo' => 'DEFINIR', 'valor' => 120, 'mes_inicio' => '2026-11'],
        ]]])->assertOk();

        $this->assertEquals(240, $this->estimadosDaCategoria($resposta, 'Academia'));
        $resposta->assertJsonPath('data.cenarios.base.resumo.saldo_final', 10000);
        $resposta->assertJsonPath('data.cenarios.personalizado.resumo.saldo_final', 9760);
    }

    #[Test]
    public function ajuste_em_recorrencia_futura_nao_toca_lancamentos_reais(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'INCOME', 'description' => 'Salário',
            'amount' => 5000, 'frequency' => 'MONTHLY', 'interval' => 1, 'day_of_month' => 5, 'start_date' => '2026-11-05',
        ]);
        $this->transacao($conta, ['type' => 'INCOME', 'amount' => 700, 'due_date' => '2026-11-10', 'description' => 'Reembolso']);

        $resposta = $this->simular(['cenario' => ['ajustes' => [
            ['id' => 's', 'alvo' => 'RECEITAS_RECORRENTES', 'modo' => 'PERCENTUAL', 'valor' => 12, 'mes_inicio' => '2026-12'],
        ]]])->assertOk();

        $eventos = collect($resposta->json('data.eventos'))->keyBy('data');
        $this->assertEquals(5000, $eventos['2026-11-05']['valor']);
        $this->assertEquals(5600, $eventos['2026-12-05']['valor']);
        $this->assertEquals(700, $eventos['2026-11-10']['valor']); // lançamento real intacto
    }

    #[Test]
    public function receita_e_despesa_hipoteticas_parceladas_em_conta(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 2000);

        $resposta = $this->simular(['cenario' => ['eventos' => [
            ['id' => 'r', 'descricao' => 'Bônus', 'tipo' => 'INCOME', 'valor' => 3000, 'data' => '2026-11-01'],
            ['id' => 'd', 'descricao' => 'Curso', 'tipo' => 'EXPENSE', 'valor' => 900, 'data' => '2026-10-15', 'parcelas' => 3],
        ]]])->assertOk();

        $resposta->assertJsonPath('data.cenarios.personalizado.resumo.receitas.hipoteticas', 3000);
        $resposta->assertJsonPath('data.cenarios.personalizado.resumo.despesas.hipoteticas', 900);
        $resposta->assertJsonPath('data.cenarios.personalizado.resumo.saldo_final', 4100);
        $curso = collect($resposta->json('data.eventos'))->where('descricao', 'Curso')->pluck('valor', 'data');
        $this->assertEquals(['2026-10-15' => 300, '2026-11-15' => 300, '2026-12-15' => 300], $curso->all());
        $this->assertEquals(0, Transacao::where('description', 'Curso')->count());
    }

    #[Test]
    public function evento_hipotetico_recorrente_e_impacto_isolado_de_cada_decisao(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 2000);

        $resposta = $this->simular(['cenario' => ['eventos' => [
            ['id' => 'aluguel', 'descricao' => 'Aluguel novo', 'tipo' => 'EXPENSE', 'valor' => 1500, 'data' => '2026-10-20', 'frequencia' => 'MONTHLY'],
            ['id' => 'extra', 'descricao' => 'Extra', 'tipo' => 'INCOME', 'valor' => 500, 'data' => '2026-11-01'],
        ]]])->assertOk();

        $resposta->assertJsonPath('data.cenarios.personalizado.resumo.despesas.hipoteticas', 4500);
        $impactos = collect($resposta->json('data.impactos'))->keyBy('id');
        $this->assertEquals(-4500, $impactos['aluguel']['impacto_saldo_final']);
        $this->assertEquals(500, $impactos['extra']['impacto_saldo_final']);
        $this->assertEquals(-1500, collect($impactos['aluguel']['mensal'])->firstWhere('mes', '2026-10')['diferenca']);
    }

    #[Test]
    public function cenario_base_nao_muda_com_o_personalizado_e_nada_e_gravado(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $mercado = $this->categoria($conta, 'Supermercado');
        $this->historico($conta, $mercado, array_fill(0, 8, 700));
        $antes = [Transacao::count(), Transacao::sum('amount'), \App\Models\RecorrenciaTransacao::count(), \App\Models\Fatura::count()];

        $semCenario = $this->simular()->assertOk();
        $comCenario = $this->simular(['cenario' => [
            'inflacao_mensal' => 0.5,
            'ajustes' => [['id' => 'x', 'alvo' => 'CATEGORIA', 'tipo' => 'EXPENSE', 'categoria_id' => $mercado->id, 'modo' => 'PERCENTUAL', 'valor' => -50]],
            'eventos' => [['id' => 'moto', 'descricao' => 'Moto', 'tipo' => 'EXPENSE', 'valor' => 20000, 'data' => '2026-12-01']],
        ]])->assertOk();

        $this->assertEquals($semCenario->json('data.cenarios.base'), $comCenario->json('data.cenarios.base'));
        $this->assertNotEquals($comCenario->json('data.cenarios.base.resumo.saldo_final'), $comCenario->json('data.cenarios.personalizado.resumo.saldo_final'));
        $comCenario->assertJsonPath('data.cenario_ativo', true);

        // "Restaurar": sem cenário, o personalizado volta a ser o base.
        $restaurado = $this->simular()->assertOk();
        $this->assertEquals($restaurado->json('data.cenarios.base'), $restaurado->json('data.cenarios.personalizado'));
        $this->assertEquals($antes, [Transacao::count(), Transacao::sum('amount'), \App\Models\RecorrenciaTransacao::count(), \App\Models\Fatura::count()]);
    }

    #[Test]
    public function otimista_e_pessimista_so_movem_valores_estimados(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 10000);
        $this->historico($conta, $this->categoria($conta, 'Lazer'), [200, 450, 150, 380, 260, 500, 180, 420]);
        $this->transacao($conta, ['amount' => 1000, 'due_date' => '2026-11-10', 'description' => 'Conta fixa']);

        $resposta = $this->simular()->assertOk();
        $base = $resposta->json('data.cenarios.base.resumo');
        $otimista = $resposta->json('data.cenarios.otimista.resumo');
        $pessimista = $resposta->json('data.cenarios.pessimista.resumo');

        $this->assertGreaterThan($base['saldo_final'], $otimista['saldo_final']);
        $this->assertLessThan($base['saldo_final'], $pessimista['saldo_final']);
        $this->assertEquals($base['despesas']['conhecidas'], $pessimista['despesas']['conhecidas']);
        $this->assertEquals($base['despesas']['conhecidas'], $otimista['despesas']['conhecidas']);
    }

    // -=-=-=- RISCOS -=-=-=-

    #[Test]
    public function identifica_saldo_negativo_em_dia_intermediario(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 1000);
        $this->transacao($conta, ['amount' => 1500, 'due_date' => '2026-10-15', 'description' => 'IPVA']);
        $this->transacao($conta, ['type' => 'INCOME', 'amount' => 2000, 'due_date' => '2026-10-20', 'description' => 'Salário']);

        $resposta = $this->simular()->assertOk();
        $risco = $resposta->json('data.riscos.saldo_negativo.personalizado');

        $this->assertSame('2026-10-15', $risco['primeira_data']);
        $this->assertEquals(-500, $risco['menor_saldo']);
        $this->assertSame('2026-10-20', $risco['volta_ao_positivo_em']);
        $this->assertSame(5, $risco['dias']);
        $this->assertSame('IPVA', $risco['contribuintes'][0]['descricao']);
        $this->assertEquals(5, $this->mes($resposta, '2026-10')['dias_negativos']);
        $resposta->assertJsonPath('data.cenarios.base.resumo.saldo_final', 1500); // termina positivo
    }

    // -=-=-=- CONTAS E TRANSFERÊNCIAS -=-=-=-

    #[Test]
    public function transferencia_entre_contas_selecionadas_nao_e_receita_nem_despesa(): void
    {
        $corrente = $this->conta(null, 'Corrente');
        $poupanca = $this->conta($corrente, 'Poupança');
        $this->saldo($corrente, 10000);

        foreach (range(1, 6) as $i) {
            SalvarTransferencia::executar($corrente->user_id, [
                'from_account_id' => $corrente->id, 'to_account_id' => $poupanca->id, 'amount' => 1000,
                'date' => Carbon::parse('2026-10-05')->subMonthsNoOverflow($i)->toDateString(),
            ]);
        }

        $todas = $this->simular()->assertOk();
        $this->assertEmpty($todas->json('data.categorias'));
        $this->assertEquals(0, collect($todas->json('data.historico'))->sum('receitas'));
        $this->assertEquals(0, collect($todas->json('data.historico'))->sum('despesas'));
        $todas->assertJsonPath('data.cenarios.base.resumo.saldo_atual', 10000);

        // Só a corrente: o saldo dela já reflete o dinheiro que saiu, e transferências não viram gasto previsto.
        $soCorrente = $this->simular(['conta_ids' => [$corrente->id]])->assertOk();
        $soCorrente->assertJsonPath('data.cenarios.base.resumo.saldo_atual', 4000);
        $soCorrente->assertJsonPath('data.cenarios.base.resumo.despesas.estimadas', 0);
        // Fim de abril (1º mês do histórico): 10.000 − a transferência de abril.
        $this->assertEquals(9000, collect($soCorrente->json('data.historico'))->first()['saldo_final']);
    }

    #[Test]
    public function filtro_de_conta_usa_so_o_saldo_e_o_historico_da_conta_escolhida(): void
    {
        $principal = $this->conta(null, 'Principal');
        $outra = $this->conta($principal, 'Outra');
        $this->saldo($principal, 5000);
        $this->saldo($outra, 3000);
        $this->historico($outra, $this->categoria($outra, 'Combustível'), array_fill(0, 6, 250));

        $resposta = $this->simular(['conta_ids' => [$principal->id]])->assertOk();

        $resposta->assertJsonPath('data.cenarios.base.resumo.saldo_atual', 5000);
        $this->assertEmpty($resposta->json('data.categorias'));
        $resposta->assertJsonCount(1, 'data.contas');
    }

    // -=-=-=- CONSISTÊNCIA E PRECISÃO -=-=-=-

    #[Test]
    public function kpis_tabelas_e_graficos_saem_dos_mesmos_numeros(): void
    {
        $conta = $this->conta();
        $this->saldo($conta, 8000);
        $cartao = $this->cartao($conta);
        $this->historico($conta, $this->categoria($conta, 'Supermercado'), [651.37, 702.19, 688.45, 710.03, 699.99, 741.11]);
        $this->historico($conta, $this->categoria($conta, 'Salário extra'), [1200.5, 1180.25, 1210.75, 1190.1, 1205.33, 1199.99], 25, 'INCOME');
        CriarDespesaCartao::executar($conta->user_id, $cartao, ['description' => 'TV', 'amount' => 2999.99, 'purchase_date' => '2026-10-02', 'installment_total' => 7]);
        $this->transacao($conta, ['amount' => 333.33, 'due_date' => '2026-11-11']);

        $resposta = $this->simular(['cenario' => ['eventos' => [
            ['id' => 'v', 'descricao' => 'Viagem', 'tipo' => 'EXPENSE', 'valor' => 5000.01, 'data' => '2026-12-02', 'cartao_id' => $cartao->id, 'parcelas' => 10],
        ]]])->assertOk();

        foreach (['base', 'otimista', 'pessimista', 'personalizado'] as $nome) {
            $cenario = $resposta->json("data.cenarios.{$nome}");
            $resumo = $cenario['resumo'];
            $meses = collect($cenario['meses']);

            $this->assertEqualsWithDelta($resumo['receitas']['total'], $meses->sum('receitas.total'), 0.011);
            $this->assertEqualsWithDelta($resumo['despesas']['total'], $meses->sum('despesas.total'), 0.011);
            $this->assertEqualsWithDelta($resumo['saldo_final'], round($resumo['saldo_atual'] + $resumo['receitas']['total'] - $resumo['despesas']['total'], 2), 0.011);
            $this->assertEquals($resumo['saldo_final'], $meses->last()['saldo_final']);
            $this->assertEquals($resumo['saldo_final'], collect($cenario['serie_diaria'])->last()['saldo']);
            $this->assertEquals($resumo['menor_saldo']['valor'], min($meses->min('saldo_minimo'), $resumo['saldo_atual']));

            foreach ($meses as $mes) {
                $this->assertEqualsWithDelta($mes['despesas']['total'], $mes['saidas'], 0.011, "Saídas de {$mes['mes']} ({$nome})");
                $this->assertEqualsWithDelta($mes['receitas']['total'], $mes['entradas'], 0.011);
            }
        }

        // Categorias (visão de caixa) somam as despesas do cenário personalizado.
        $despesasPorCategoria = collect($resposta->json('data.categorias_mes'))->where('tipo', 'EXPENSE')->sum('total');
        $this->assertEqualsWithDelta($resposta->json('data.cenarios.personalizado.resumo.despesas.total'), $despesasPorCategoria, 0.011);

        // Valores monetários com no máximo 2 casas.
        foreach ($resposta->json('data.eventos') as $evento) {
            $this->assertEquals(round($evento['valor'], 2), $evento['valor']);
        }
    }

    // -=-=-=- ISOLAMENTO -=-=-=-

    #[Test]
    public function dados_de_outro_usuario_nao_entram_na_simulacao(): void
    {
        $alheia = Conta::factory()->create();
        $this->saldo($alheia, 99999);
        $categoriaAlheia = Categoria::create(['user_id' => $alheia->user_id, 'name' => 'Alheia']);
        $this->historico($alheia, $categoriaAlheia, array_fill(0, 6, 800));

        $conta = $this->conta();
        $this->saldo($conta, 100);

        $resposta = $this->simular()->assertOk();
        $resposta->assertJsonPath('data.cenarios.base.resumo.saldo_atual', 100);
        $this->assertEmpty($resposta->json('data.categorias'));

        $this->simular(['conta_ids' => [$alheia->id]])->assertUnprocessable();
        $this->simular(['cenario' => ['ajustes' => [
            ['alvo' => 'CATEGORIA', 'tipo' => 'EXPENSE', 'categoria_id' => $categoriaAlheia->id, 'modo' => 'DEFINIR', 'valor' => 10],
        ]]])->assertUnprocessable();
    }

    #[Test]
    public function cenarios_salvos_guardam_so_configuracao_e_sao_isolados_por_usuario(): void
    {
        $conta = $this->conta();

        $criado = $this->postJson('/api/relatorios/simulador-financeiro/cenarios', [
            'name' => 'Comprando uma moto',
            'settings' => [
                'horizonte' => 12,
                'cenario' => ['eventos' => [['id' => 'm', 'descricao' => 'Moto', 'tipo' => 'EXPENSE', 'valor' => 20000, 'data' => '2027-01-10']]],
            ],
        ])->assertCreated();

        $id = $criado->json('data.id');
        $this->getJson('/api/relatorios/simulador-financeiro/cenarios')->assertOk()->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.settings.cenario.eventos.0.descricao', 'Moto');
        $this->assertEquals(0, Transacao::where('description', 'Moto')->count());

        $this->putJson("/api/relatorios/simulador-financeiro/cenarios/{$id}", ['name' => 'Moto à vista', 'settings' => ['horizonte' => 6]])
            ->assertOk()->assertJsonPath('data.name', 'Moto à vista');

        // Outro usuário não vê nem altera.
        $this->conta();
        $this->getJson('/api/relatorios/simulador-financeiro/cenarios')->assertOk()->assertJsonCount(0, 'data');
        $this->deleteJson("/api/relatorios/simulador-financeiro/cenarios/{$id}")->assertNotFound();
    }
}
