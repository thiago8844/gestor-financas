<?php

namespace Database\Seeders;

use App\Enums\TransactionStatus;
use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Transacao;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class JonilsonSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $jonilson = User::factory()->create([
            'name' => 'Jonilson',
            'email' => 'jonilson@email.com',
            'password' => bcrypt('123'),
        ]);

        $contaJonilson = Conta::create([
            'user_id' => $jonilson->id,
            'name' => 'Conta Fazenda',
            'type' => 'INCOME',
            'role' => 'USER',
            'active' => true,
            'include_in_networth' => true,
            'currency' => 'BRL',
            'instituicao' => 'Banco do Brasil',
        ]);

        // Categorias Jonilson
        $categoriasJonilson = [
            'Venda de Gado' => ['type' => 'INCOME', 'icon' => '🐄'],
            'Venda de Leite' => ['type' => 'INCOME', 'icon' => '🥛'],
            'Venda de Grãos' => ['type' => 'INCOME', 'icon' => '🌾'],
            'Arrendamento' => ['type' => 'INCOME', 'icon' => '🚜'],
            'Ração' => ['type' => 'EXPENSE', 'icon' => '🌽'],
            'Veterinário' => ['type' => 'EXPENSE', 'icon' => '💉'],
            'Funcionários' => ['type' => 'EXPENSE', 'icon' => '👷'],
            'Combustível' => ['type' => 'EXPENSE', 'icon' => '⛽'],
            'Manutenção' => ['type' => 'EXPENSE', 'icon' => '🔧'],
            'Insumos' => ['type' => 'EXPENSE', 'icon' => '🧪'],
            'Energia Rural' => ['type' => 'EXPENSE', 'icon' => '⚡'],
            'Impostos' => ['type' => 'EXPENSE', 'icon' => '📋'],
            'Equipamentos' => ['type' => 'EXPENSE', 'icon' => '🚜'],
            'Lazer' => ['type' => 'EXPENSE', 'icon' => '🎣'],
        ];

        foreach ($categoriasJonilson as $nome => $dados) {
            Categoria::create([
                'name' => $nome,
                // 'type' => $dados['type'],
                // 'icon' => $dados['icon'],
                'user_id' => $jonilson->id,
            ]);
        }

        // Gerar 12 meses de transações Jonilson
        for ($i = 0; $i < 12; $i++) {
            $mesAtual = Carbon::now()->subMonths(11 - $i)->startOfMonth();

            // RECEITAS JONILSON
            // Venda de gado (principal receita)
            Transacao::create([
                'account_id' => $contaJonilson->id,
                'category_id' => Categoria::where('name', 'Venda de Gado')->where('user_id', $jonilson->id)->first()->id,
                'amount' => 30000,
                'type' => 'INCOME',
                'date' => $mesAtual->copy()->day(rand(10, 20)),
                'description' => rand(20, 40) . ' cabeças de gado',
                'user_id' => $jonilson->id,
                'status' => TransactionStatus::PAID
            ]);

            // Venda de leite (semanal)
            for ($semana = 0; $semana < 4; $semana++) {
                Transacao::create([
                    'account_id' => $contaJonilson->id,
                    'category_id' => Categoria::where('name', 'Venda de Leite')->where('user_id', $jonilson->id)->first()->id,
                    'amount' => rand(1500, 2500),
                    'type' => 'INCOME',
                    'date' => $mesAtual->copy()->day(($semana * 7) + rand(1, 7)),
                    'description' => 'Produção semanal',
                    'user_id' => $jonilson->id,
                    'status' => TransactionStatus::PAID
                ]);
            }

            // Venda de grãos (trimestral)
            if ($i % 3 === 0) {
                Transacao::create([
                    'account_id' => $contaJonilson->id,
                    'category_id' => Categoria::where('name', 'Venda de Grãos')->where('user_id', $jonilson->id)->first()->id,
                    'amount' => rand(15000, 25000),
                    'type' => 'INCOME',
                    'date' => $mesAtual->copy()->day(rand(5, 15)),
                    'description' => ['Soja', 'Milho', 'Trigo'][rand(0, 2)],
                    'user_id' => $jonilson->id,
                    'status' => TransactionStatus::PAID
                ]);
            }

            // Arrendamento (semestral)
            if ($i % 6 === 0) {
                Transacao::create([
                    'account_id' => $contaJonilson->id,
                    'category_id' => Categoria::where('name', 'Arrendamento')->where('user_id', $jonilson->id)->first()->id,
                    'amount' => rand(8000, 12000),
                    'type' => 'INCOME',
                    'date' => $mesAtual->copy()->day(rand(1, 10)),
                    'description' => 'Arrendamento de terras',
                    'user_id' => $jonilson->id,
                    'status' => TransactionStatus::PAID
                ]);
            }

            // DESPESAS JONILSON
            $despesasJonilson = [
                // Despesas fixas mensais
                ['categoria' => 'Funcionários', 'valor' => rand(8000, 12000), 'descricao' => 'Folha de pagamento', 'dia' => 5],
                ['categoria' => 'Ração', 'valor' => rand(3000, 5000), 'descricao' => 'Ração para gado', 'dia' => rand(8, 12)],
                ['categoria' => 'Energia Rural', 'valor' => rand(500, 1200), 'descricao' => 'Conta de energia', 'dia' => 15],
                ['categoria' => 'Combustível', 'valor' => rand(2000, 4000), 'descricao' => 'Diesel e gasolina', 'dia' => rand(10, 20)],

                // Manutenção
                ['categoria' => 'Manutenção', 'valor' => rand(800, 2000), 'descricao' => 'Manutenção tratores', 'dia' => rand(5, 25)],
                ['categoria' => 'Manutenção', 'valor' => rand(500, 1500), 'descricao' => 'Cercas e instalações', 'dia' => rand(10, 28)],

                // Insumos
                ['categoria' => 'Insumos', 'valor' => rand(1000, 3000), 'descricao' => 'Fertilizantes e defensivos', 'dia' => rand(8, 18)],
            ];

            // Veterinário (2x por mês)
            $despesasJonilson[] = ['categoria' => 'Veterinário', 'valor' => rand(800, 1500), 'descricao' => 'Consultas e vacinas', 'dia' => rand(1, 15)];
            $despesasJonilson[] = ['categoria' => 'Veterinário', 'valor' => rand(600, 1200), 'descricao' => 'Medicamentos', 'dia' => rand(16, 28)];

            // Impostos (trimestral)
            if ($i % 3 === 0) {
                $despesasJonilson[] = ['categoria' => 'Impostos', 'valor' => rand(3000, 6000), 'descricao' => 'ITR e outros impostos', 'dia' => rand(15, 25)];
            }

            // Equipamentos (esporádico)
            if (rand(1, 100) <= 20) {
                $despesasJonilson[] = ['categoria' => 'Equipamentos', 'valor' => rand(5000, 15000), 'descricao' => ['Novo implemento', 'Peças trator', 'Equipamento ordenha'][rand(0, 2)], 'dia' => rand(5, 25)];
            }

            // Lazer
            $despesasJonilson[] = ['categoria' => 'Lazer', 'valor' => rand(500, 2000), 'descricao' => 'Churrasco/Festa', 'dia' => rand(20, 28)];

            foreach ($despesasJonilson as $despesa) {
                Transacao::create([
                    'account_id' => $contaJonilson->id,
                    'category_id' => Categoria::where('name', $despesa['categoria'])->where('user_id', $jonilson->id)->first()->id,
                    'amount' => $despesa['valor'],
                    'type' => 'EXPENSE',
                    'date' => $mesAtual->copy()->day($despesa['dia']),
                    'description' => $despesa['descricao'],
                    'user_id' => $jonilson->id,
                    'status' => TransactionStatus::PAID
                ]);
            }
        }

        echo "\n✅ Seed completo!\n";
        echo "👨‍💼 CLT - Email: clt@email.com | Senha: 123\n";
        echo "🐄 Jonilson - Email: jonilson@email.com | Senha: 123\n";
    }
}
