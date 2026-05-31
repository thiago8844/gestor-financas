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

class CltSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // ============= USUÁRIO CLT (POBRE) =============
        $clt = User::factory()->create([
            'name' => 'CLT',
            'email' => 'clt@email.com',
            'password' => bcrypt('123'),
        ]);

        $contaCLT = Conta::create([
            'user_id' => $clt->id,
            'name' => 'Conta Corrente',
            'type' => 'INCOME',
            'role' => 'USER',
            'active' => true,
            'include_in_networth' => true,
            'currency' => 'BRL',
            'instituicao' => 'Caixa Econômica',
        ]);

        Transacao::create([
            'account_id' => $contaCLT->id,
            'amount' => 0,
            'type' => 'INCOME',
            'date' => now(),
            'description' => 'Saldo inicial da conta ' . $contaCLT->name,
            'user_id' => $contaCLT->user_id,
            'status' => 'PAID',
            'is_initial_balance' => true,
        ]);


        // Categorias CLT
        $categoriasCLT = [
            'SALÁRIO' => ['type' => 'INCOME', 'icon' => '💰'],
            'FREELANCE' => ['type' => 'INCOME', 'icon' => '💻'],
            'SUPERMERCADO' => ['type' => 'EXPENSE', 'icon' => '🛒'],
            'TRANSPORTE' => ['type' => 'EXPENSE', 'icon' => '🚌'],
            'ENERGIA' => ['type' => 'EXPENSE', 'icon' => '⚡'],
            'ÁGUA' => ['type' => 'EXPENSE', 'icon' => '💧'],
            'INTERNET' => ['type' => 'EXPENSE', 'icon' => '🌐'],
            'TELEFONE' => ['type' => 'EXPENSE', 'icon' => '📱'],
            'ALUGUEL' => ['type' => 'EXPENSE', 'icon' => '🏠'],
            'LAZER' => ['type' => 'EXPENSE', 'icon' => '🎮'],
            'FARMÁCIA' => ['type' => 'EXPENSE', 'icon' => '💊'],
            'VESTUÁRIO' => ['type' => 'EXPENSE', 'icon' => '👕'],
            'EDUCAÇÃO' => ['type' => 'EXPENSE', 'icon' => '📚'],
        ];

        foreach ($categoriasCLT as $nome => $dados) {
            Categoria::create([
                'name' => $nome, // Já está em maiúsculas
                // 'type' => $dados['type'],
                // 'icon' => $dados['icon'],
                'user_id' => $clt->id,
            ]);
        }
        
        $mesBase = Carbon::now()->startOfMonth();
        // Gerar 12 meses de transações CLT
        for ($i = 0; $i < 12; $i++) {
            $mesAtual = $mesBase->copy()->subMonthsNoOverflow(11 - $i);

            // RECEITAS CLT
            // Salário fixo
            Transacao::create([
                'account_id' => $contaCLT->id,
                'category_id' => Categoria::where('name', 'SALÁRIO')->where('user_id', $clt->id)->first()->id,
                'amount' => 2500,
                'type' => 'INCOME',
                'date' => $mesAtual->copy()->day(1),
                'description' => 'Salário Mensal',
                'user_id' => $clt->id,
                'status' => TransactionStatus::PAID
            ]);

            // Freelance esporádico (30% de chance)
            if (rand(1, 100) <= 30) {
                Transacao::create([
                    'account_id' => $contaCLT->id,
                    'category_id' => Categoria::where('name', 'FREELANCE')->where('user_id', $clt->id)->first()->id,
                    'amount' => rand(150, 400),
                    'type' => 'INCOME',
                    'date' => $mesAtual->copy()->day(rand(10, 25)),
                    'description' => 'Freelance - ' . ['Site', 'Logo', 'Sistema'][rand(0, 2)],
                    'user_id' => $clt->id,
                    'status' => TransactionStatus::PAID
                ]);
            }

            // DESPESAS CLT
            $despesasCLT = [
                // Aluguel
                ['categoria' => 'ALUGUEL', 'valor' => 800, 'descricao' => 'Aluguel', 'dia' => 10],

                // Contas fixas
                ['categoria' => 'ENERGIA', 'valor' => rand(80, 150), 'descricao' => 'Conta de Luz', 'dia' => 15],
                ['categoria' => 'ÁGUA', 'valor' => rand(40, 80), 'descricao' => 'Conta de Água', 'dia' => 18],
                ['categoria' => 'INTERNET', 'valor' => 89.90, 'descricao' => 'Internet Banda Larga', 'dia' => 20],
                ['categoria' => 'TELEFONE', 'valor' => 49.90, 'descricao' => 'Plano Celular', 'dia' => 22],

                // Transporte
                ['categoria' => 'TRANSPORTE', 'valor' => rand(150, 200), 'descricao' => 'Vale Transporte', 'dia' => 5],
                ['categoria' => 'TRANSPORTE', 'valor' => rand(30, 60), 'descricao' => 'Uber/99', 'dia' => rand(8, 12)],
                ['categoria' => 'TRANSPORTE', 'valor' => rand(20, 40), 'descricao' => 'Gasolina', 'dia' => rand(15, 20)],

                // Educação
                ['categoria' => 'EDUCAÇÃO', 'valor' => rand(300, 500), 'descricao' => 'Mensalidade Faculdade', 'dia' => 8],
            ];

            // Supermercado (4 compras no mês)
            $totalSupermercado = rand(300, 500);
            $compras = 4;
            for ($j = 0; $j < $compras; $j++) {
                $valor = $j === $compras - 1
                    ? $totalSupermercado
                    : rand(50, $totalSupermercado * 0.4);
                $totalSupermercado -= $valor;

                $despesasCLT[] = [
                    'categoria' => 'SUPERMERCADO',
                    'valor' => $valor,
                    'descricao' => ['Mercado Extra', 'Supermercado Zona Sul', 'Atacadão', 'Carrefour'][rand(0, 3)],
                    'dia' => rand(1, 28)
                ];
            }

            // Lazer esporádico
            $despesasCLT[] = ['categoria' => 'LAZER', 'valor' => rand(50, 150), 'descricao' => ['Cinema', 'Lanchonete', 'Pizza', 'Bar'][rand(0, 3)], 'dia' => rand(5, 25)];
            if (rand(1, 100) <= 50) {
                $despesasCLT[] = ['categoria' => 'LAZER', 'valor' => rand(30, 80), 'descricao' => 'Delivery', 'dia' => rand(10, 28)];
            }

            // Farmácia esporádica
            if (rand(1, 100) <= 40) {
                $despesasCLT[] = ['categoria' => 'FARMÁCIA', 'valor' => rand(30, 120), 'descricao' => 'Remédios', 'dia' => rand(1, 28)];
            }

            // Vestuário esporádico
            if (rand(1, 100) <= 25) {
                $despesasCLT[] = ['categoria' => 'VESTUÁRIO', 'valor' => rand(80, 200), 'descricao' => ['Roupa', 'Tênis', 'Calça'][rand(0, 2)], 'dia' => rand(1, 28)];
            }

            foreach ($despesasCLT as $despesa) {
                Transacao::create([
                    'account_id' => $contaCLT->id,
                    'category_id' => Categoria::where('name', $despesa['categoria'])->where('user_id', $clt->id)->first()->id,
                    'amount' => $despesa['valor'],
                    'type' => 'EXPENSE',
                    'date' => $mesAtual->copy()->day($despesa['dia']),
                    'description' => $despesa['descricao'],
                    'user_id' => $clt->id,
                    'status' => TransactionStatus::PAID
                ]);
            }
        }
    }
}
