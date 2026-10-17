<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Marca o lançamento como conferido contra o extrato. Um lançamento só pode ser conciliado uma
     * vez; o pagamento de fatura (N compras = 1 débito no banco) liga todas as compras ao mesmo item.
     * Se a conciliação for excluída, o vínculo some e o lançamento continua intacto.
     */
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->foreignId('reconciliation_item_id')
                ->nullable()
                ->after('ofx_import_id')
                ->constrained('reconciliation_items')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('reconciliation_item_id');
        });
    }
};
