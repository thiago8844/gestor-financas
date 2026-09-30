<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            // Dia em que a quitação automática foi ligada. Só faturas que vencem a partir dele são
            // quitadas sozinhas — faturas antigas em aberto não podem virar "pagas" sem o usuário saber.
            $table->date('auto_pay_invoices_since')->nullable()->after('auto_pay_invoices');
        });
    }

    public function down(): void
    {
        Schema::table('user_settings', function (Blueprint $table) {
            $table->dropColumn('auto_pay_invoices_since');
        });
    }
};
