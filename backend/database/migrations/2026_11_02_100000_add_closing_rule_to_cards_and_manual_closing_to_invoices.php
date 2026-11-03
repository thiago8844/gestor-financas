<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('cards', function (Blueprint $table) {
            $table->string('closing_rule', 20)->default('FIXED_DAY')->after('closing_day')
                ->comment('FIXED_DAY: dia fixo do mês; DAYS_BEFORE_DUE: X dias antes do vencimento');
            $table->unsignedTinyInteger('closing_days_before_due')->nullable()->after('closing_rule');
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->boolean('closing_manual')->default(false)->after('closing_date')
                ->comment('Fechamento ajustado à mão pelo usuário (não segue a regra do cartão)');
        });
    }

    public function down(): void
    {
        Schema::table('invoices', fn (Blueprint $table) => $table->dropColumn('closing_manual'));
        Schema::table('cards', fn (Blueprint $table) => $table->dropColumn(['closing_rule', 'closing_days_before_due']));
    }
};
