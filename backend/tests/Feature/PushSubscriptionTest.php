<?php

namespace Tests\Feature;

use App\Models\Notificacao;
use App\Models\PushSubscription;
use App\Models\User;
use App\Support\Push\EnviadorPush;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class PushSubscriptionTest extends TestCase
{
    use RefreshDatabase;

    private function payload(string $endpoint = 'https://push.example.com/abc'): array
    {
        return ['endpoint' => $endpoint, 'keys' => ['p256dh' => 'chave-publica', 'auth' => 'segredo']];
    }

    #[Test]
    public function registra_inscricao_sem_duplicar_o_mesmo_endpoint(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/push/inscricoes', $this->payload())->assertCreated();
        $this->postJson('/api/push/inscricoes', $this->payload())->assertCreated();

        $this->assertEquals(1, PushSubscription::where('user_id', $user->id)->count());
    }

    #[Test]
    public function remove_inscricao_apenas_do_proprio_usuario(): void
    {
        $dono = User::factory()->create();
        $outro = User::factory()->create();

        Sanctum::actingAs($dono);
        $this->postJson('/api/push/inscricoes', $this->payload())->assertCreated();

        Sanctum::actingAs($outro);
        $this->deleteJson('/api/push/inscricoes', ['endpoint' => 'https://push.example.com/abc'])->assertOk();
        $this->assertEquals(1, PushSubscription::count());

        Sanctum::actingAs($dono);
        $this->deleteJson('/api/push/inscricoes', ['endpoint' => 'https://push.example.com/abc'])->assertOk();
        $this->assertEquals(0, PushSubscription::count());
    }

    #[Test]
    public function exige_autenticacao_e_valida_o_corpo(): void
    {
        $this->postJson('/api/push/inscricoes', $this->payload())->assertUnauthorized();

        Sanctum::actingAs(User::factory()->create());
        $this->postJson('/api/push/inscricoes', ['endpoint' => 'nao-e-url'])->assertUnprocessable();
    }

    #[Test]
    public function devolve_a_chave_publica(): void
    {
        config(['webpush.vapid.public_key' => 'CHAVE']);
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/push/chave-publica')->assertOk()->assertJson(['public_key' => 'CHAVE']);
    }

    #[Test]
    public function criar_notificacao_dispara_o_envio_do_push(): void
    {
        $enviador = \Mockery::mock(EnviadorPush::class);
        $enviador->shouldReceive('enviar')->once()->with(\Mockery::type(Notificacao::class));
        $this->app->instance(EnviadorPush::class, $enviador);

        $user = User::factory()->create();

        Notificacao::create(['user_id' => $user->id, 'type' => 't', 'title' => 'x', 'message' => 'y']);
    }

    #[Test]
    public function sem_chaves_vapid_o_envio_fica_desligado_e_nao_quebra(): void
    {
        config(['webpush.vapid.public_key' => null, 'webpush.vapid.private_key' => null]);
        $user = User::factory()->create();
        PushSubscription::create([
            'user_id' => $user->id, 'endpoint_hash' => 'h', 'endpoint' => 'https://x', 'public_key' => 'a', 'auth_token' => 'b',
        ]);

        $notificacao = Notificacao::create(['user_id' => $user->id, 'type' => 't', 'title' => 'x', 'message' => 'y']);

        $this->assertFalse((new EnviadorPush())->ativo());
        $this->assertNotNull($notificacao->id);
    }
}
