<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Adiciona os campos de cartão de crédito em transactions.
     *
     * Eles foram incluídos na migration original (create_transaction), que já
     * havia sido executada em produção. Esta migration garante que as colunas
     * existam em bases que rodaram a versão antiga.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (! Schema::hasColumn('transactions', 'card_id')) {
                $table->foreignId('card_id')
                    ->nullable()
                    ->after('is_initial_balance')
                    ->constrained('cards')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('transactions', 'invoice_id')) {
                $table->foreignId('invoice_id')
                    ->nullable()
                    ->after('card_id')
                    ->constrained('invoices')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('transactions', 'purchase_date')) {
                $table->date('purchase_date')
                    ->nullable()
                    ->after('invoice_id')
                    ->comment('Data original da compra no cartão, não muda se a fatura for corrigida depois');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Não removemos as colunas: podem conter dados de cartão já cadastrados.
    }
};
