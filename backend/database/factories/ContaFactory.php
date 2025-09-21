<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Api\Account>
 */
class ContaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {

        return [
            "name" => $this->faker->word(),
            "user_id" => User::factory(),
            "type" =>  $this->faker->randomElement(['EXPENSE', 'INCOME']),
            "role" => $this->faker->randomElement(['BANK', 'CASH', 'CREDIT_CARD', 'INVESTMENT']),
            "active" => 1,
            "include_in_networth" => 1,
            "currency" => "BRL",
            "instituicao" => Str::upper($this->faker->word()),

        ];
    }
}
