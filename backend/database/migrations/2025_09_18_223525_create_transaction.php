<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();

            // FK para usuário
            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            // FK para conta
            $table->foreignId('account_id')
                ->constrained('accounts')
                ->onDelete('cascade');

            // FK opcional para categoria
            // TODO: DESCOMENTAR QUANDO FOR IMPLEMENTAR AS CATEGORIAS
            // $table->foreignId('category_id')
            //     ->nullable()
            //     ->constrained('categories')
            //     ->nullOnDelete();

            $table->decimal('amount', 12, 2); // valor positivo sempre
            $table->enum('type', ['INCOME', 'EXPENSE']); // tipo da transação
            $table->string('description', 255)->nullable();
            $table->enum('status', ['PENDING', 'PAID'])->default('PENDING');
            $table->date('date'); // data do movimento

            // -=-=- Parcelas -=-=-
            $table->integer('installment_number')->nullable(); 
            $table->integer('installment_total')->nullable();
            $table->uuid('installment_group')->nullable();  
            $table->date('due_date')->nullable();
            $table->date('paid_date')->nullable();

            // -=-=- Transferências -=-=-
            //TODO: DESCOMENTAR QUANDO FOR IMPLEMENTAR AS TRANSFERÊNCIAS
            // $table->foreignId('transfer_id')
            //     ->nullable()
            //     ->constrained('transfers')
            //     ->nullOnDelete();

            // -=-=- Recorrência -=-=-
            // TODO: QUANDO FOR IMPLEMENTAR TRANSAÇÕES RECORRENTES POR JOB E ASSINATURAS COLOCAR AS COLUNAS AQUI

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transaction');
    }
};
