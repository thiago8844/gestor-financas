<?php

namespace Tests\Feature;

use App\Models\Conta;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Foundation\Testing\WithFaker;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * Para rodar esse teste eu uso php artisan test tests/Feature/AccountTest.php
 */

class AccountTest extends TestCase
{

    use RefreshDatabase;

    #[Test]
    public function cria_uma_conta(): void
    {
        
        $user = User::factory()->create();

        $conta = Conta::create([
            "name" => "Conta Corrente",
            "user_id" => $user->id,
            "type" => "INCOME",
            "role" => "Banco",
            "active" => 1,
            "include_in_networth" => 1,
            "currency" => "BRL",
            "instituicao" => "SANTANDER",
        ]);


        $contaFactory = Conta::factory()->create();

        $this->assertDatabaseHas('accounts', [
            'id' => $conta->id,
            'name' => $conta->name
        ]);
        $this->assertDatabaseHas('accounts', [
            'id' => $contaFactory->id,
            'name' => $contaFactory->name
        ]);

    }



}
