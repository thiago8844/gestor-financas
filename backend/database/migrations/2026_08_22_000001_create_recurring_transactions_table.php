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
        Schema::create('recurring_transactions', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            $table->foreignId('account_id')
                ->constrained('accounts')
                ->onDelete('cascade');

            $table->foreignId('category_id')
                ->nullable()
                ->constrained('categories')
                ->nullOnDelete();

            $table->enum('type', ['INCOME', 'EXPENSE']);
            $table->string('description', 255);

            $table->decimal('amount', 12, 2)->nullable()->comment('Valor fixo; null = valor variável, preenchido em cada ocorrência');
            $table->enum('default_status', ['PENDING', 'PAID'])->default('PENDING')->comment('Status com que cada ocorrência nasce');

            $table->enum('frequency', ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
            $table->unsignedInteger('interval')->default(1)->comment('A cada X dias/meses/anos (não usado em WEEKLY)');
            $table->json('days_of_week')->nullable()->comment('Array de 0 (domingo) a 6 (sábado), só para WEEKLY');
            $table->unsignedTinyInteger('day_of_month')->nullable()->comment('1-31, para MONTHLY/YEARLY');
            $table->unsignedTinyInteger('month_of_year')->nullable()->comment('1-12, só para YEARLY');

            $table->date('start_date');
            $table->date('end_date')->nullable();
            $table->date('next_run_date')->index();

            $table->boolean('active')->default(true);
            $table->timestamp('last_generated_at')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('recurring_transactions');
    }
};
