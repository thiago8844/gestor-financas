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
        Schema::create('user_settings', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')
                ->unique()
                ->constrained()
                ->onDelete('cascade');

            // Notificação de aviso: quantos dias antes do vencimento começar a avisar (0 = desligado, máx. 7).
            $table->unsignedTinyInteger('notify_upcoming_days')->default(3);

            // Quitar automaticamente as faturas de cartão quando vencerem (pagamento em débito automático).
            $table->boolean('auto_pay_invoices')->default(false);

            // Notificação de urgência: por quantos dias após o vencimento continuar avisando (0 = desligado, máx. 7).
            $table->unsignedTinyInteger('notify_overdue_days')->default(3);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_settings');
    }
};
