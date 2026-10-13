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

class DashboardDespesasFuturasTest extends TestCase
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

    #[Test]
    public function separa_parcelas_recorrencias_e_outras_sem_contar_nada_duas_vezes(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $cartao = Cartao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id,
            'name' => 'Nubank', 'closing_day' => 10, 'due_day' => 20, 'active' => true,
        ]);

        // R$ 1.200 em 4x: faturas de 20/10, 20/11, 20/12 e 20/01 (a última fica fora do horizonte).
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Notebook', 'amount' => 1200, 'purchase_date' => '2026-10-05', 'installment_total' => 4,
        ]);
        // Compra à vista no cartão: "outras".
        CriarDespesaCartao::executar($conta->user_id, $cartao, [
            'description' => 'Mercado', 'amount' => 200, 'purchase_date' => '2026-10-06',
        ]);
        // Avulsa pendente: "outras".
        Transacao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id, 'type' => 'EXPENSE',
            'amount' => 50, 'status' => 'PENDING', 'due_date' => '2026-10-25', 'description' => 'Dentista',
        ]);
        // Já paga: não é futura.
        Transacao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id, 'type' => 'EXPENSE',
            'amount' => 999, 'status' => 'PAID', 'date' => '2026-10-02', 'description' => 'Paga',
        ]);
        // Receita pendente: não é despesa.
        Transacao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id, 'type' => 'INCOME',
            'amount' => 5000, 'status' => 'PENDING', 'due_date' => '2026-10-25', 'description' => 'Salário',
        ]);
        // Aluguel: 15/10, 15/11, 15/12.
        CriarRecorrenciaTransacao::executar($conta->user_id, [
            'account_id' => $conta->id, 'default_status' => 'PENDING', 'type' => 'EXPENSE',
            'description' => 'Aluguel', 'amount' => 1200, 'frequency' => 'MONTHLY',
            'interval' => 1, 'day_of_month' => 15, 'start_date' => '2026-10-15',
        ]);

        $r = $this->getJson('/api/dashboard/despesas-futuras?data_final=2026-12-31')->assertOk();

        $r->assertJsonPath('parcelas.total', 900);
        $r->assertJsonPath('parcelas.quantidade', 3);
        $r->assertJsonPath('recorrencias.total', 3600);
        $r->assertJsonPath('recorrencias.quantidade', 3);
        $r->assertJsonPath('outras.total', 250);
        $r->assertJsonPath('total', 900 + 3600 + 250);
        $r->assertJsonCount(3, 'meses');
        $r->assertJsonCount(3, 'faturas');
    }

    #[Test]
    public function exige_data_final_futura(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->getJson('/api/dashboard/despesas-futuras')->assertStatus(422);
        $this->getJson('/api/dashboard/despesas-futuras?data_final=2026-01-01')->assertStatus(422);
    }
}
