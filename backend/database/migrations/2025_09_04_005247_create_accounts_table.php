<?php

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
        Schema::create('accounts', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(User::class)->constrained()->onDelete('cascade');
            $table->string('name')->unique();
            $table->enum('type', ['EXPENSE', 'INCOME']);
            $table->string('role')->nullable()->comment('Tipo da conta, dinheiro, banco, cartão de crédito , conta corrente, etc...');
            $table->boolean('active')->default(true);
            $table->boolean('include_in_networth')->default(true);
            $table->string('currency');
            $table->string('instituicao')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('accounts');
    }
};
