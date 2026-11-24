<?php

namespace Tests\Feature;

use App\Actions\GerarTransacoesRecorrentes;
use App\Actions\Notificacoes\GerarNotificacoes;
use App\Enums\FrequenciaRecorrencia;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Conta;
use App\Models\OfxImport;
use App\Models\Orcamento;
use App\Models\RecorrenciaTransacao;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NotificacaoNovasRegrasTest extends TestCase
{
    use RefreshDatabase;

    private function recorrencia(Conta $conta, array $extra = []): RecorrenciaTransacao
    {
        return RecorrenciaTransacao::create(array_merge([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Aluguel',
            'amount' => 1500,
            'default_status' => TransactionStatus::PENDING,
            'frequency' => FrequenciaRecorrencia::MONTHLY,
            'interval' => 1,
            'day_of_month' => 5,
            'start_date' => '2026-08-05',
            'next_run_date' => '2026-08-05',
            'active' => true,
        ], $extra));
    }

    #[Test]
    public function recorrencia_lancada_gera_uma_notificacao_agrupando_ocorrencias_atrasadas(): void
    {
        $conta = Conta::factory()->create();
        $this->recorrencia($conta);

        // Ago, set e out de uma vez: 3 lançamentos, 1 notificação.
        (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-10-05'));

        $this->assertDatabaseCount('notifications', 1);
        $this->assertDatabaseHas('notifications', ['user_id' => $conta->user_id, 'type' => 'recorrencia_lancada']);
        $this->assertStringContainsString('3 despesas', \App\Models\Notificacao::first()->message);
    }

    #[Test]
    public function recorrencia_que_se_encerra_avisa_na_notificacao(): void
    {
        $conta = Conta::factory()->create();
        $this->recorrencia($conta, ['end_date' => '2026-08-31']);

        (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-08-05'));

        $this->assertStringContainsString('encerrada', \App\Models\Notificacao::first()->message);
    }

    #[Test]
    public function sem_ocorrencia_gerada_nao_notifica(): void
    {
        $conta = Conta::factory()->create();
        $this->recorrencia($conta);

        (new GerarTransacoesRecorrentes())->executar(Carbon::parse('2026-08-01'));

        $this->assertDatabaseCount('notifications', 0);
    }

    #[Test]
    public function avisa_recorrencia_perto_do_fim_uma_vez(): void
    {
        $conta = Conta::factory()->create();
        $this->recorrencia($conta, ['end_date' => now()->addDays(3)->toDateString(), 'next_run_date' => now()->addDays(20)->toDateString()]);

        (new GerarNotificacoes())->executar();
        (new GerarNotificacoes())->executar();

        $this->assertEquals(1, \App\Models\Notificacao::where('type', 'recorrencia_encerrando')->count());
    }

    #[Test]
    public function avisa_orcamento_estourado(): void
    {
        $conta = Conta::factory()->create();
        $orcamento = Orcamento::create([
            'user_id' => $conta->user_id,
            'name' => 'Lazer',
            'type' => 'RECURRING',
            'amount_limit' => 100,
            'alert_percentage' => 80,
            'frequency' => 'MONTHLY',
            'interval' => 1,
            'start_date' => '2026-01-01',
        ]);
        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'budget_id' => $orcamento->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Cinema',
            'amount' => 150,
            'status' => TransactionStatus::PAID,
            'date' => now()->toDateString(),
        ]);

        (new GerarNotificacoes())->executar();

        $this->assertEquals(1, \App\Models\Notificacao::where('type', 'orcamento')->where('severity', 'danger')->count());
    }

    #[Test]
    public function avisa_saldo_negativo_e_receita_atrasada(): void
    {
        $conta = Conta::factory()->create();
        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Compra',
            'amount' => 500,
            'status' => TransactionStatus::PAID,
            'date' => now()->toDateString(),
        ]);
        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::INCOME,
            'description' => 'Freela',
            'amount' => 300,
            'status' => TransactionStatus::PENDING,
            'due_date' => now()->subDays(2)->toDateString(),
        ]);

        (new GerarNotificacoes())->executar();

        $this->assertDatabaseHas('notifications', ['type' => 'saldo_negativo']);
        $this->assertDatabaseHas('notifications', ['type' => 'receita_atrasada']);
    }

    #[Test]
    public function avisa_importacao_ofx_parada(): void
    {
        $conta = Conta::factory()->create();
        $import = OfxImport::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'original_filename' => 'extrato.ofx',
            'file_hash' => str_repeat('a', 64),
            'status' => 'STAGED',
        ]);
        $import->forceFill(['created_at' => now()->subDays(3)])->save();

        (new GerarNotificacoes())->executar();

        $this->assertDatabaseHas('notifications', ['type' => 'importacao_ofx_pendente']);
    }
}
