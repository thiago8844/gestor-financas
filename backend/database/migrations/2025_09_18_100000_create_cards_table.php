<?php

use App\Models\Conta;
use App\Models\User;
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
        Schema::create('cards', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class)->constrained()->onDelete('cascade');
            $table->foreignIdFor(Conta::class, 'account_id')
                ->constrained('accounts')
                ->onDelete('cascade')
                ->comment('Conta usada para pagar as faturas do cartão');
            $table->string('name');
            $table->unsignedTinyInteger('closing_day')->comment('Dia do fechamento da fatura, 1-31');
            $table->unsignedTinyInteger('due_day')->comment('Dia do vencimento da fatura, 1-31');
            $table->boolean('active')->default(true);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('cards');
    }
};
