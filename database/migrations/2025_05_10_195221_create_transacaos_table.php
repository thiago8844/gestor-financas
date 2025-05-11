<?php

use App\Models\Categoria;
use App\Models\Conta;
use App\Models\Orcamento;
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
        Schema::create('transacao', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
            $table->foreignIdFor(Conta::class)->constrained()->onDelete('cascade');
            $table->foreignIdFor(User::class)->constrained()->onDelete('cascade');
            $table->foreignIdFor(Categoria::class)->nullable()->constrained()->nullOnDelete();
            $table->foreignIdFor(Orcamento::class)->nullable()->constrained()->nullOnDelete();
            $table->date('data');
            $table->enum('tipo', ['entrada', 'saida']);
            $table->decimal('valor', 10, 2);
            $table->string('descricao');
            $table->boolean('paga')->default(true);
            $table->boolean('repetir')->nullable();
            $table->boolean('fixa')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transacaos');
    }
};
