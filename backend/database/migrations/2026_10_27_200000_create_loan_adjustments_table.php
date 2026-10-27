<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Amortizações extras (o devedor abate parte do principal) e aumentos (emprestar mais no mesmo contrato).
        Schema::create('loan_adjustments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('loan_id')->constrained('loans')->onDelete('cascade');
            $table->enum('type', ['AMORTIZACAO', 'AUMENTO']);
            $table->date('date');

            $table->decimal('amount', 12, 2)->comment('Valor que abate ou acrescenta ao principal');
            $table->decimal('accrued_interest', 12, 2)->default(0)->comment('Juros proporcionais cobrados junto da amortização');
            $table->enum('mode', ['MANTER_PRAZO', 'MANTER_PARCELA'])->default('MANTER_PRAZO');

            $table->decimal('balance_before', 12, 2);
            $table->decimal('balance_after', 12, 2);

            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->nullOnDelete();

            $table->timestamps();

            $table->index(['loan_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_adjustments');
    }
};
