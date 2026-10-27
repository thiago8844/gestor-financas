<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loan_installments', function (Blueprint $table) {
            $table->id();

            $table->foreignId('loan_id')->constrained('loans')->onDelete('cascade');

            $table->unsignedSmallInteger('number');
            $table->date('due_date');

            $table->decimal('principal_amount', 12, 2)->default(0)->comment('Parte que amortiza o saldo devedor');
            $table->decimal('interest_amount', 12, 2)->default(0);
            $table->decimal('expected_amount', 12, 2)->comment('principal + juros');
            $table->decimal('paid_amount', 12, 2)->default(0)->comment('Acumula pagamentos parciais');
            $table->date('paid_at')->nullable()->comment('Data do último pagamento');

            $table->enum('status', ['PREVISTA', 'PARCIAL', 'PAGA', 'CANCELADA'])->default('PREVISTA');

            $table->timestamps();

            $table->unique(['loan_id', 'number']);
            $table->index(['due_date', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loan_installments');
    }
};
