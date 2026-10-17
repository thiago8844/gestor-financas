<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Itens da conciliação:
     *  - EXTRATO: cada linha do OFX, com o que foi decidido sobre ela (conciliada, adiada, ignorada);
     *  - APP: lançamento que está no app mas não no extrato e que o usuário confirmou que está certo.
     * Os lançamentos conferidos apontam para o item em transactions.reconciliation_item_id.
     */
    public function up(): void
    {
        Schema::create('reconciliation_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reconciliation_id')->constrained('reconciliations')->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            $table->enum('source', ['EXTRATO', 'APP'])->default('EXTRATO');
            $table->string('external_id')->comment('FITID do OFX (ou hash da linha); "app:..." para itens só do app');
            $table->string('fitid')->nullable();

            // -=-=- Dados do extrato, nunca editáveis -=-=-
            $table->enum('type', ['INCOME', 'EXPENSE']);
            $table->decimal('amount', 12, 2);
            $table->date('transaction_date');
            $table->text('description')->nullable();

            // -=-=- Resolução -=-=-
            $table->enum('status', ['PENDENTE', 'CONCILIADO', 'ADIADO', 'IGNORADO'])->default('PENDENTE');
            $table->enum('matched_by', ['AUTO', 'MANUAL'])->nullable();
            $table->foreignId('invoice_id')
                ->nullable()
                ->constrained('invoices')
                ->nullOnDelete()
                ->comment('Preenchido quando a linha é o pagamento de uma fatura');
            $table->text('note')->nullable()->comment('Motivo de ignorar/adiar');
            $table->timestamp('resolved_at')->nullable();

            $table->timestamps();

            $table->unique(['reconciliation_id', 'external_id']);
            $table->index(['reconciliation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reconciliation_items');
    }
};
