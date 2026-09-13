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
        Schema::create('budget_limit_history', function (Blueprint $table) {
            $table->id();

            $table->foreignId('budget_id')
                ->constrained('budgets')
                ->onDelete('cascade');

            $table->decimal('amount_limit', 12, 2)->nullable();
            $table->date('effective_from')->comment('A partir de qual data esse limite passa a valer');

            $table->timestamps();

            $table->index(['budget_id', 'effective_from']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('budget_limit_history');
    }
};
