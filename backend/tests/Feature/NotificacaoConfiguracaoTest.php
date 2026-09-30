<?php

namespace Tests\Feature;

use App\Actions\Faturas\QuitarFaturasAutomaticamente;
use App\Actions\Notificacoes\GerarNotificacoes;
use App\Enums\TransactionStatus;
use App\Enums\TransactionType;
use App\Models\Cartao;
use App\Models\ConfiguracaoUsuario;
use App\Models\Conta;
use App\Models\Fatura;
use App\Models\Notificacao;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class NotificacaoConfiguracaoTest extends TestCase
{
    use RefreshDatabase;

    private function despesa(Conta $conta, int $diasParaVencer, array $extra = []): Transacao
    {
        return Transacao::create(array_merge([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => TransactionType::EXPENSE,
            'description' => 'Conta de luz',
            'amount' => 150,
            'status' => TransactionStatus::PENDING,
            'due_date' => now()->addDays($diasParaVencer)->toDateString(),
        ], $extra));
    }

    private function configurar(Conta $conta, array $valores): void
    {
        ConfiguracaoUsuario::updateOrCreate(['user_id' => $conta->user_id], $valores);
    }

    /** Fatura de cartão com uma compra pendente. */
    private function faturaComCompra(Conta $conta, int $diasParaVencer, float $valor = 300): Fatura
    {
        $cartao = Cartao::create([
            'user_id' => $conta->user_id, 'account_id' => $conta->id,
            'name' => 'Nubank', 'closing_day' => 1, 'due_day' => 10, 'active' => true,
        ]);

        $vencimento = now()->addDays($diasParaVencer);
        $fatura = Fatura::create([
            'user_id' => $conta->user_id, 'card_id' => $cartao->id,
            'reference_month' => $vencimento->copy()->startOfMonth()->toDateString(),
            'closing_date' => $vencimento->copy()->subDays(7)->toDateString(),
            'due_date' => $vencimento->toDateString(),
        ]);

        // Duas compras: a notificação tem que ser UMA por fatura, não uma por compra.
        foreach ([$valor / 2, $valor / 2] as $parte) {
            Transacao::create([
                'user_id' => $conta->user_id, 'account_id' => $conta->id, 'card_id' => $cartao->id,
                'invoice_id' => $fatura->id, 'type' => TransactionType::EXPENSE, 'description' => 'Compra',
                'amount' => $parte, 'status' => TransactionStatus::PENDING, 'due_date' => $vencimento->toDateString(),
            ]);
        }

        return $fatura;
    }

    #[Test]
    public function avisa_pagamentos_dentro_da_janela_de_dias_antes(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['notify_upcoming_days' => 5, 'notify_overdue_days' => 0]);

        $this->despesa($conta, 0);   // hoje
        $this->despesa($conta, 5);   // limite da janela
        $this->despesa($conta, 6);   // fora

        (new GerarNotificacoes())->executar();

        $this->assertSame(2, Notificacao::where('type', 'pagamento_a_vencer')->count());
    }

    #[Test]
    public function aviso_desligado_com_zero_dias(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['notify_upcoming_days' => 0, 'notify_overdue_days' => 0]);
        $this->despesa($conta, 1);

        $this->assertSame(0, (new GerarNotificacoes())->executar());
    }

    #[Test]
    public function aviso_e_diario_mas_nao_repete_no_mesmo_dia(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['notify_upcoming_days' => 7, 'notify_overdue_days' => 0]);
        $this->despesa($conta, 3);

        $this->assertSame(1, (new GerarNotificacoes())->executar());
        $this->assertSame(0, (new GerarNotificacoes())->executar());

        $this->travelTo(now()->addDay());
        $this->assertSame(1, (new GerarNotificacoes())->executar()); // dia seguinte: novo lembrete
    }

    #[Test]
    public function avisa_despesa_vencida_somente_ate_x_dias_depois(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['notify_upcoming_days' => 0, 'notify_overdue_days' => 2]);

        $this->despesa($conta, -1);  // dentro
        $this->despesa($conta, -2);  // limite
        $this->despesa($conta, -3);  // já passou do prazo: para de avisar

        (new GerarNotificacoes())->executar();

        $this->assertSame(2, Notificacao::where('type', 'despesa_vencida')->count());
    }

    #[Test]
    public function urgencia_desligada_com_zero_dias(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['notify_upcoming_days' => 0, 'notify_overdue_days' => 0]);
        $this->despesa($conta, -1);

        $this->assertSame(0, (new GerarNotificacoes())->executar());
    }

    #[Test]
    public function usuario_sem_configuracao_usa_os_padroes(): void
    {
        $conta = Conta::factory()->create();
        $this->despesa($conta, 2);  // padrão: avisa até 3 dias antes
        $this->despesa($conta, -2); // padrão: avisa até 3 dias depois

        (new GerarNotificacoes())->executar();

        $this->assertSame(1, Notificacao::where('type', 'pagamento_a_vencer')->count());
        $this->assertSame(1, Notificacao::where('type', 'despesa_vencida')->count());
    }

    #[Test]
    public function fatura_de_cartao_gera_uma_notificacao_por_fatura(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['notify_upcoming_days' => 3, 'notify_overdue_days' => 3]);
        $this->faturaComCompra($conta, 2);   // a vencer
        $this->faturaComCompra($conta, -1);  // atrasada (outro cartão com o mesmo nome? nome único por usuário só na API)

        (new GerarNotificacoes())->executar();

        $aVencer = Notificacao::where('type', 'pagamento_a_vencer')->get();
        $vencida = Notificacao::where('type', 'despesa_vencida')->get();

        $this->assertCount(1, $aVencer);
        $this->assertStringContainsString('fatura do cartão Nubank', $aVencer[0]->message);
        $this->assertStringContainsString('R$ 300,00', $aVencer[0]->message);
        $this->assertCount(1, $vencida);
        $this->assertSame('Fatura atrasada', $vencida[0]->title);
    }

    #[Test]
    public function fatura_paga_nao_gera_notificacao(): void
    {
        $conta = Conta::factory()->create();
        $fatura = $this->faturaComCompra($conta, -1);
        Transacao::where('invoice_id', $fatura->id)->update(['status' => TransactionStatus::PAID, 'date' => now()->toDateString()]);

        $this->assertSame(0, (new GerarNotificacoes())->executar());
    }

    #[Test]
    public function quita_faturas_vencidas_quando_a_opcao_esta_ligada(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['auto_pay_invoices' => true, 'auto_pay_invoices_since' => now()->subDays(10)->toDateString()]);

        $vencida = $this->faturaComCompra($conta, -2);
        $venceHoje = $this->faturaComCompra($conta, 0);
        $futura = $this->faturaComCompra($conta, 5);

        $quitadas = (new QuitarFaturasAutomaticamente())->executar();

        $this->assertSame(2, $quitadas);
        $this->assertSame(0, Transacao::where('invoice_id', $vencida->id)->where('status', 'PENDING')->count());
        $this->assertSame(0, Transacao::where('invoice_id', $venceHoje->id)->where('status', 'PENDING')->count());
        $this->assertSame(2, Transacao::where('invoice_id', $futura->id)->where('status', 'PENDING')->count());

        // Paga na data do vencimento, e deixa rastro.
        $this->assertSame($vencida->due_date->toDateString(), Transacao::where('invoice_id', $vencida->id)->first()->date->toDateString());
        $this->assertSame(2, Notificacao::where('type', 'fatura_quitada_automaticamente')->count());
    }

    #[Test]
    public function nao_quita_fatura_anterior_ao_dia_em_que_a_opcao_foi_ligada(): void
    {
        $conta = Conta::factory()->create();
        $this->configurar($conta, ['auto_pay_invoices' => true, 'auto_pay_invoices_since' => now()->subDay()->toDateString()]);
        $antiga = $this->faturaComCompra($conta, -20);

        $this->assertSame(0, (new QuitarFaturasAutomaticamente())->executar());
        $this->assertSame(2, Transacao::where('invoice_id', $antiga->id)->where('status', 'PENDING')->count());
    }

    #[Test]
    public function nao_quita_quando_a_opcao_esta_desligada(): void
    {
        $conta = Conta::factory()->create();
        $this->faturaComCompra($conta, -2);

        $this->assertSame(0, (new QuitarFaturasAutomaticamente())->executar());
    }

    #[Test]
    public function ligar_a_opcao_pela_api_registra_o_dia_e_desligar_limpa(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->putJson('/api/configuracoes', ['notify_upcoming_days' => 3, 'auto_pay_invoices' => true, 'notify_overdue_days' => 3])->assertOk();
        $this->assertSame(now()->toDateString(), ConfiguracaoUsuario::first()->auto_pay_invoices_since->toDateString());

        $this->putJson('/api/configuracoes', ['notify_upcoming_days' => 3, 'auto_pay_invoices' => false, 'notify_overdue_days' => 3])->assertOk();
        $this->assertNull(ConfiguracaoUsuario::first()->auto_pay_invoices_since);
    }
}
