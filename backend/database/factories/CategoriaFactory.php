<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Categoria>
 */
class CategoriaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {

        $icones = [
            'fas fa-utensils',      // Alimentação - garfo e faca
            'fas fa-car',           // Transporte - carro
            'fas fa-heartbeat',     // Saúde - batimento cardíaco
            'fas fa-graduation-cap', // Educação - capelo
            'fas fa-gamepad',       // Lazer - controle de jogo
            'fas fa-home',          // Casa - casa
            'fas fa-tshirt',        // Roupas - camiseta
            'fas fa-chart-line',    // Investimentos - gráfico
            'fas fa-wallet',        // Salário - carteira
            'fas fa-laptop-code'    // Freelance - laptop com código
        ];

        return [
            "name" => $this->faker->word(),
            "color" => $this->faker->hexColor(),
            "icon" => $this->faker->randomElement($icones),
        ];
    }
}
