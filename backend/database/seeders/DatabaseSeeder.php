<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            TesteSeeder::class,
            // JonilsonSeeder::class, // desativado
            // CltSeeder::class, // desativado
        ]);

        echo "\n✅ Seed completo!\n";
        echo "🧪 Teste - Email: teste@email.com | Senha: 123\n";
    }
}
