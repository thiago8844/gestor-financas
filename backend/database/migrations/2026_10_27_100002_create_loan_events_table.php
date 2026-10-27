<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Histórico do contrato (criação, baixas, reversões...), no mesmo espírito de invoice_audits.
        Schema::create('loan_events', function (Blueprint $table) {
            $table->id();

            $table->foreignId('loan_id')->constrained('loans')->onDelete('cascade');
            $table->foreignId('installment_id')->nullable()->constrained('loan_installments')->nullOnDelete();

            $table->string('type', 40);
            $table->string('message', 255);
            $table->json('data')->nullable();

            $table->timestamps();

            $table->index(['loan_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_events');
    }
};
