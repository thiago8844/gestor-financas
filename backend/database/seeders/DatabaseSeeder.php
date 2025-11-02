<?php

namespace Database\Seeders;

use App\Enums\TransactionStatus;
use App\Models\Conta;
use App\Models\Transacao;
use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

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

        $saldoInicial = 1000;

        Transacao::create([
            'account_id' => $conta->id,
            'amount' => $saldoInicial,
            'type' => 'INCOME',
            'date' => now(),
            'description' => 'Saldo inicial da conta ' . $conta->name,
            'user_id' => $conta->user_id,
            'is_initial_balance' => true,
            'status' => TransactionStatus::PAID
        ]);


        //TODO: CRIAR CONTA SEEDER
        $this->call([
            CategoriaSeeder::class,
        ], false, ['userId' => $user->id]);
    }
}
