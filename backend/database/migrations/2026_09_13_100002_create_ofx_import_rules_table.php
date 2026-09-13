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
        Schema::create('ofx_import_rules', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            $table->string('name', 255)->nullable();

            $table->json('conditions')->comment('Ex: {"descricao_contains":"UBER","tipo":"EXPENSE"} — formato genérico para crescer depois');
            $table->json('actions')->comment('Ex: {"descricao":"Uber","category_id":5,"budget_id":null}');

            $table->boolean('active')->default(true);
            $table->unsignedInteger('vezes_aplicada')->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ofx_import_rules');
    }
};
