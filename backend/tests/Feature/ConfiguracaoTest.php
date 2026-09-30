<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ConfiguracaoTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function retorna_os_valores_padrao_na_primeira_vez(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/configuracoes')
            ->assertOk()
            ->assertJsonPath('data.notify_upcoming_days', 3)
            ->assertJsonPath('data.auto_pay_invoices', false)
            ->assertJsonPath('data.notify_overdue_days', 3);
    }

    #[Test]
    public function atualiza_as_configuracoes_do_usuario(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->putJson('/api/configuracoes', [
            'notify_upcoming_days' => 7,
            'auto_pay_invoices' => true,
            'notify_overdue_days' => 0,
        ])->assertOk()->assertJsonPath('data.notify_upcoming_days', 7);

        $this->getJson('/api/configuracoes')
            ->assertJsonPath('data.notify_upcoming_days', 7)
            ->assertJsonPath('data.auto_pay_invoices', true)
            ->assertJsonPath('data.notify_overdue_days', 0);
    }

    #[Test]
    public function limita_os_dias_a_no_maximo_sete(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->putJson('/api/configuracoes', [
            'notify_upcoming_days' => 8,
            'auto_pay_invoices' => false,
            'notify_overdue_days' => 8,
        ])->assertStatus(422)->assertJsonValidationErrors(['notify_upcoming_days', 'notify_overdue_days']);

        $this->putJson('/api/configuracoes', [
            'notify_upcoming_days' => -1,
            'auto_pay_invoices' => false,
            'notify_overdue_days' => 3,
        ])->assertStatus(422)->assertJsonValidationErrors(['notify_upcoming_days']);
    }

    #[Test]
    public function cada_usuario_tem_as_suas_configuracoes(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();

        Sanctum::actingAs($a);
        $this->putJson('/api/configuracoes', [
            'notify_upcoming_days' => 5, 'auto_pay_invoices' => true, 'notify_overdue_days' => 5,
        ])->assertOk();

        Sanctum::actingAs($b);
        $this->getJson('/api/configuracoes')
            ->assertJsonPath('data.notify_upcoming_days', 3)
            ->assertJsonPath('data.auto_pay_invoices', false);
    }

    #[Test]
    public function exige_autenticacao(): void
    {
        $this->getJson('/api/configuracoes')->assertStatus(401);
    }
}
