<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Auditoria manual da fatura: o usuário compara a fatura do banco com a do app fora do sistema
     * (PDF/planilha) e registra aqui o total que o banco cobrou. O app guarda o total que ele tinha
     * naquele momento para sinalizar diferença — e se a fatura mudar depois da auditoria.
     */
    public function up(): void
    {
        Schema::create('invoice_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('invoice_id')->constrained('invoices')->onDelete('cascade');

            $table->decimal('bank_total', 12, 2)->comment('Total da fatura segundo o banco');
            $table->decimal('app_total', 12, 2)->comment('Total da fatura no app no momento da auditoria');
            $table->decimal('difference', 12, 2)->comment('bank_total - app_total');
            $table->text('note')->nullable();

            $table->timestamps();

            $table->index(['invoice_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_audits');
    }
};
