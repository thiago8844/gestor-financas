<?php

namespace Tests\Feature;

use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Transacao;
use App\Models\Conta;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    

}
