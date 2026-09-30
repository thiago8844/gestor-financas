<?php

namespace Database\Seeders;

use App\Enums\TransactionStatus;
use App\Models\Conta;
use App\Models\Transacao;
use App\Models\User;
use Illuminate\Database\Seeder;

class TesteSeeder extends Seeder
{
    /**
     * Usuário de teste padrão, com uma única conta, para uso manual durante o desenvolvimento.
     */
    public function run(): void
    {
        $user = User::factory()->create([
            'name' => 'TESTE',
            'email' => 'teste@email.com',
            'password' => bcrypt('123'),
        ]);

        $conta = Conta::create([
            'user_id' => $user->id,
            'name' => 'Conta Padrão',
            'type' => 'INCOME',
            'role' => 'USER',
            'active' => true,
            'include_in_networth' => true,
            'currency' => 'BRL',
            'instituicao' => 'Banco do Brasil',
        ]);

        Transacao::create([
            'account_id' => $conta->id,
            'amount' => 1000,
            'type' => 'INCOME',
            'date' => now(),
            'description' => 'Saldo inicial da conta ' . $conta->name,
            'user_id' => $conta->user_id,
            'is_initial_balance' => true,
            'status' => TransactionStatus::PAID,
        ]);

        $this->call(CategoriaSeeder::class, false, ['userId' => $user->id]);
    }
}
