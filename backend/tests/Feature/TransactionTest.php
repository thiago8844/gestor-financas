<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transacao;
use App\Models\Conta;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;
use Illuminate\Support\Str;

class TransactionTest extends TestCase
{

    use RefreshDatabase;

    #[Test]
    public function cria_uma_transacao(): void
    {

        $conta = Conta::factory()->create();

        $transacao = Transacao::create([
            "user_id" => $conta->user->id,
            "account_id" => $conta->id,
            "amount" => 20,
            "type" => TransactionType::INCOME,
            "description" => 'teste',
            "status" => TransactionStatus::PAID,
            "date" => now()
        ]);

        $transacao2 = Transacao::factory()->create();

        $this->assertDatabaseHas('transactions', [
            'id' => $transacao->id,
            'amount' => $transacao->amount
        ]);

        $this->assertDatabaseHas('transactions', [
            'id' => $transacao2->id,
            'amount' => $transacao2->amount
        ]);
    }

    #[Test]
    public function testar_relacionamentos(): void {
        $transacao = Transacao::factory()->create();

        $this->assertNotNull($transacao->conta);
        $this->assertNotNull($transacao->conta->user);
        $this->assertNotNull($transacao->user);

    }

    #[Test]
    public function testar_parcelamento(): void {

        $grupoParcelas =  Str::uuid();

        for ($i = 1; $i <= 5; $i++) {
            Transacao::factory()->create([
                "amount" => 100,
                "type" => TransactionType::EXPENSE,
                "description" => "Parcela $i de 5",
                "status" => $i < 3 ? TransactionStatus::PAID : TransactionStatus::PENDING,
                "date" => now()->addMonths($i - 1),
                "installment_number" => $i,
                "installment_total" => 5,
                "installment_group" => $grupoParcelas, 
                "due_date" => now()->addMonths($i - 1)->addDays(10)
            ]);
        }

        //Testar se vieram todas as parcelas corretamente
        $parcelas = Transacao::parcelasDoGrupo($grupoParcelas)->get();
        $this->assertEquals($parcelas->count(), 5);

        //Testar Totais
        $totais = Transacao::resumoParcelas($grupoParcelas);

        $this->assertEquals(500, $totais['total']);
        $this->assertEquals(200, $totais['pagas']);
        $this->assertEquals(300, $totais['pendentes']);
        $this->assertEquals(5, $totais['quantidade']);

    }

    #[Test]
    public function cria_transacao_parcelada_via_endpoint(): void {

        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $parcelas = [];
        for ($i = 1; $i <= 12; $i++) {
            $parcelas[] = [
                'amount' => 150.00,
                'date' => $i <= 2 ? now()->addMonths($i - 1)->toDateString() : null,
                'due_date' => now()->addMonths($i - 1)->addDays(10)->toDateString(),
                'status' => $i <= 2 ? TransactionStatus::PAID->value : TransactionStatus::PENDING->value,
            ];
        }

        $response = $this->postJson('/api/transacoes/parceladas', [
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE->value,
            'description' => 'Geladeira Brastemp',
            'category_name' => 'Eletrodomésticos',
            'installment_total' => 12,
            'parcelas' => $parcelas,
        ]);

        $response->assertStatus(201);

        $installmentGroup = $response->json('installment_group');
        $this->assertNotNull($installmentGroup);

        $criadas = Transacao::where('installment_group', $installmentGroup)->orderBy('installment_number')->get();

        $this->assertEquals(12, $criadas->count());
        $this->assertEquals(1800.00, $criadas->sum('amount'));
        $this->assertEquals(2, $criadas->where('status', TransactionStatus::PAID)->count());
        $this->assertEquals(1, $criadas->first()->installment_number);
        $this->assertEquals(12, $criadas->first()->installment_total);
        $this->assertEquals('Geladeira Brastemp', $criadas->first()->description);
        $this->assertNotNull($criadas->first()->category_id);
    }

}
