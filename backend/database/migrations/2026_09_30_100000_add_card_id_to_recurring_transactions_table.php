<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recurring_transactions', function (Blueprint $table) {
            // Recorrência lançada no cartão (ex.: assinaturas): cada ocorrência vira uma compra na fatura.
            // Sem nullOnDelete de propósito: apagar o cartão não pode transformar a recorrência em
            // despesa de conta sem o usuário perceber (o CartaoController bloqueia a exclusão).
            $table->foreignId('card_id')
                ->nullable()
                ->after('account_id')
                ->constrained('cards');
        });
    }

    public function down(): void
    {
        Schema::table('recurring_transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('card_id');
        });
    }
};
