<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Cenários salvos do Simulador Financeiro: só a CONFIGURAÇÃO (filtros, ajustes e eventos
        // hipotéticos), nunca cópia de lançamentos — ao abrir, o cenário é reaplicado sobre os
        // dados financeiros atuais.
        Schema::create('simulation_scenarios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('name', 100);
            $table->string('description', 255)->nullable();
            $table->json('settings');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('simulation_scenarios');
    }
};
