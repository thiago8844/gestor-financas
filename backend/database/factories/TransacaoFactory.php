<?php

namespace Database\Factories;

use App\Enums\TransactionType;
use App\Models\Conta;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Api\Transaction>
 */
class TransacaoFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {

        $conta = Conta::factory()->create();

        return [
            "user_id" => $conta->user->id,
            "account_id" => $conta->id,
            "amount" => $this->faker->numberBetween(1, 10000),
            "type" => $this->faker->randomElement([TransactionType::INCOME, TransactionType::EXPENSE]),
            "description" => $this->faker->sentence(
                $this->faker->numberBetween(2, 15)
            ),
            "status" => 'PAID',
            "date" => $this->faker->dateTimeBetween('now', 'now + 1 year')
        ];
    }
}
