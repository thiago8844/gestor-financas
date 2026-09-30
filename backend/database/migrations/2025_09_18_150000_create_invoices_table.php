<?php

use App\Models\Cartao;
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
        Schema::create('invoices', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class)->constrained()->onDelete('cascade');
            $table->foreignIdFor(Cartao::class, 'card_id')->constrained('cards')->onDelete('cascade');

            $table->date('reference_month')->comment('Primeiro dia do mês de competência da fatura');
            $table->date('closing_date')->comment('Data de fechamento desta fatura');
            $table->date('due_date')->comment('Data de vencimento desta fatura');

            $table->timestamps();

            $table->unique(['card_id', 'reference_month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('invoices');
    }
};
