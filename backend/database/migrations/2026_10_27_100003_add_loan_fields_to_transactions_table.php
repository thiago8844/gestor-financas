<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // loan_id marca todo lançamento gerado por um empréstimo (inclusive o do principal, na contratação);
        // loan_installment_id marca só os pagamentos de parcela (uma parcela pode ter vários, se for paga em partes).
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('loan_id')->nullable()->constrained('loans')->nullOnDelete();
            $table->foreignId('loan_installment_id')->nullable()->constrained('loan_installments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('loan_installment_id');
            $table->dropConstrainedForeignId('loan_id');
        });
    }
};
