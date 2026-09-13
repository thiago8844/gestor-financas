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
        Schema::create('ofx_import_items', function (Blueprint $table) {
            $table->id();

            $table->foreignId('ofx_import_id')
                ->constrained('ofx_imports')
                ->onDelete('cascade');

            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            $table->string('fitid')->nullable();

            // -=-=- Dados vindos do OFX, travados, nunca editáveis pelo usuário -=-=-
            $table->enum('type', ['INCOME', 'EXPENSE']);
            $table->decimal('amount', 12, 2);
            $table->date('transaction_date');
            $table->text('descricao_original')->comment('NAME/MEMO do OFX, imutável');

            // -=-=- Dados editáveis pelo usuário durante a revisão -=-=-
            $table->text('descricao')->nullable()->comment('Cópia editável, começa igual à descricao_original');

            $table->foreignId('account_id')
                ->nullable()
                ->constrained('accounts')
                ->nullOnDelete();

            $table->foreignId('category_id')
                ->nullable()
                ->constrained('categories')
                ->nullOnDelete();

            $table->foreignId('budget_id')
                ->nullable()
                ->constrained('budgets')
                ->nullOnDelete();

            $table->enum('status', ['PENDENTE', 'DUPLICADA', 'IGNORADA', 'IMPORTADA'])->default('PENDENTE');
            $table->boolean('selecionada')->default(true);

            $table->foreignId('matched_transaction_id')
                ->nullable()
                ->constrained('transactions')
                ->nullOnDelete()
                ->comment('Transação real já existente que fez este item ser marcado como duplicado');

            $table->foreignId('regra_aplicada_id')
                ->nullable()
                ->constrained('ofx_import_rules')
                ->nullOnDelete();

            $table->foreignId('created_transaction_id')
                ->nullable()
                ->constrained('transactions')
                ->nullOnDelete()
                ->comment('Preenchido ao confirmar a importação');

            $table->timestamps();

            $table->index(['ofx_import_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ofx_import_items');
    }
};
