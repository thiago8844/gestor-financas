<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Conciliação bancária: uma por conta por mês. Guarda o extrato (OFX) enviado, o saldo que o
     * banco informou e, ao finalizar, o retrato do fechamento (é o registro da auditoria do mês).
     */
    public function up(): void
    {
        Schema::create('reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('account_id')->constrained('accounts')->onDelete('cascade');

            $table->date('reference_month')->comment('Primeiro dia do mês conciliado');
            $table->date('period_start');
            $table->date('period_end');

            $table->enum('status', ['ABERTA', 'FINALIZADA'])->default('ABERTA');

            $table->string('original_filename')->nullable()->comment('Último extrato enviado');
            $table->string('file_hash', 64)->nullable();
            $table->string('storage_path')->nullable();

            $table->decimal('statement_balance', 12, 2)->nullable()->comment('Saldo final informado pelo banco no OFX (LEDGERBAL)');
            $table->date('statement_balance_date')->nullable();

            $table->json('summary')->nullable()->comment('Retrato do fechamento, gravado ao finalizar');
            $table->text('note')->nullable()->comment('Observação/justificativa do fechamento');
            $table->timestamp('finalized_at')->nullable();
            $table->timestamp('reopened_at')->nullable();

            $table->timestamps();

            $table->unique(['account_id', 'reference_month']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reconciliations');
    }
};
