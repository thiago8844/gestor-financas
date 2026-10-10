<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('transfers', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            $table->foreignId('from_account_id')->constrained('accounts')->onDelete('cascade');
            $table->foreignId('to_account_id')->constrained('accounts')->onDelete('cascade');

            $table->decimal('amount', 12, 2);
            $table->date('date');
            $table->string('description', 255)->nullable();

            $table->timestamps();
        });

        // Cada transferência gera duas transações (saída na origem, entrada no destino) para que o
        // saldo das contas continue sendo calculado só a partir de `transactions`. O transfer_id é o
        // que permite excluí-las dos relatórios de receita/despesa, já que transferir não é ganhar nem gastar.
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('transfer_id')
                ->nullable()
                ->after('is_initial_balance')
                ->constrained('transfers')
                ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('transfer_id');
        });

        Schema::dropIfExists('transfers');
    }
};
