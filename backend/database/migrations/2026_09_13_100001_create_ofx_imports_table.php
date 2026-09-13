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
        Schema::create('ofx_imports', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            $table->foreignId('account_id')
                ->nullable()
                ->constrained('accounts')
                ->nullOnDelete();

            $table->string('original_filename');
            $table->string('file_hash', 64)->comment('sha256 do conteúdo do arquivo, bloqueia reimportar o mesmo arquivo');
            $table->string('storage_path')->nullable();

            $table->string('ofx_version', 10)->nullable();
            $table->date('period_start')->nullable();
            $table->date('period_end')->nullable();

            $table->unsignedInteger('total_transactions')->default(0);
            $table->unsignedInteger('imported_transactions')->default(0);
            $table->unsignedInteger('duplicate_transactions')->default(0);
            $table->unsignedInteger('ignored_transactions')->default(0);

            $table->enum('status', ['STAGED', 'CONFIRMED', 'UNDONE'])->default('STAGED');

            $table->timestamp('finalizada_at')->nullable();
            $table->timestamp('undone_at')->nullable();

            $table->timestamps();

            $table->unique(['user_id', 'file_hash']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ofx_imports');
    }
};
