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
        Schema::create('ofx_account_mappings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->constrained()
                ->onDelete('cascade');

            $table->string('account_hash', 64)->comment('sha256 de bank_id|acct_id, evita guardar número de conta em claro');
            $table->string('bank_id')->nullable();
            $table->string('account_number_masked', 20)->nullable()->comment('Só para exibição, ex: ****1234');
            $table->string('acct_type')->nullable();

            $table->foreignId('account_id')
                ->constrained('accounts')
                ->onDelete('cascade');

            $table->timestamps();

            $table->unique(['user_id', 'account_hash']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ofx_account_mappings');
    }
};
