<?php

namespace Database\Seeders;

use App\Models\Categoria;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class CategoriaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 
     *  php artisan db:seed --class=CategoriaSeeder
     */
    public function run(): void
    {
        $userId = func_get_args()[0]['userId'] ?? 1;
        
        $categorias = [
            ['name' => 'ALIMENTAÇÃO'],
            ['name' => 'TRANSPORTE'],
            ['name' => 'SAÚDE'],
            ['name' => 'EDUCAÇÃO'],
            ['name' => 'LAZER'],
            ['name' => 'MORADIA'],
            ['name' => 'ROUPAS'],
            ['name' => 'INVESTIMENTOS'],
            ['name' => 'SALÁRIO'],
            ['name' => 'FREELANCE'],
            ['name' => 'COMBUSTÍVEL'],
            ['name' => 'TELEFONE'],
            ['name' => 'INTERNET'],
            ['name' => 'SUPERMERCADO'],
            ['name' => 'FARMÁCIA'],
            ['name' => 'ACADEMIA'],
            ['name' => 'BELEZA'],
            ['name' => 'PETS'],
            ['name' => 'SEGUROS'],
            ['name' => 'IMPOSTOS'],
        ];

        foreach ($categorias as $categoria) {
            Categoria::create(
                [
                    'user_id' => $userId,
                    'name' => $categoria['name'],
                   
                ]
            );
        }
    }
}
