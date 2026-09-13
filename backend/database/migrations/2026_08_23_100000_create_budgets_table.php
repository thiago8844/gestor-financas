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
        Schema::create('budgets', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            $table->string('name', 255);
            $table->text('description')->nullable();

            $table->enum('type', ['ONE_TIME', 'RECURRING']);

            $table->decimal('amount_limit', 12, 2)->nullable()->comment('Limite de gasto; null = sem limite, só acompanhamento');
            $table->unsignedTinyInteger('alert_percentage')->nullable()->comment('1-100, alerta ao atingir esse % do limite');
            $table->boolean('ignore_pending_installments')->default(false)->comment('Compras parceladas contam pelo valor total, uma única vez, em vez de parcela por parcela');
            $table->boolean('active')->default(true);

            $table->enum('frequency', ['WEEKLY', 'MONTHLY', 'YEARLY'])->nullable()->comment('Só para RECURRING');
            $table->unsignedInteger('interval')->default(1)->comment('A cada X meses, só usado com frequency=MONTHLY');
            $table->date('start_date')->nullable()->comment('Âncora do cálculo de período, só para RECURRING');

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budgets');
    }
};
