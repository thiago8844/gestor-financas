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
        Schema::table('transactions', function (Blueprint $table) {
            $table->string('fitid')->nullable()->after('budget_id');

            $table->foreignId('ofx_import_id')
                ->nullable()
                ->after('fitid')
                ->constrained('ofx_imports')
                ->nullOnDelete();

            $table->unique(['account_id', 'fitid']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique(['account_id', 'fitid']);
            $table->dropConstrainedForeignId('ofx_import_id');
            $table->dropColumn('fitid');
        });
    }
};
