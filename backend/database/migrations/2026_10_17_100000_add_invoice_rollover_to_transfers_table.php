<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pagamento parcial de fatura: o saldo que não foi pago "rola" para a fatura seguinte como
     * um par de lançamentos (crédito na fatura paga, débito na próxima) ligados a uma transferência
     * do tipo FATURA. Reaproveitar transfers faz os relatórios ignorarem a rolagem sem mudar nenhuma
     * query (todas já filtram transfer_id). As transferências que já existem ficam como CONTA.
     */
    public function up(): void
    {
        Schema::table('transfers', function (Blueprint $table) {
            $table->enum('kind', ['CONTA', 'FATURA'])->default('CONTA')->after('user_id');

            $table->foreignId('source_invoice_id')
                ->nullable()
                ->after('to_account_id')
                ->constrained('invoices')
                ->cascadeOnDelete();

            $table->foreignId('target_invoice_id')
                ->nullable()
                ->after('source_invoice_id')
                ->constrained('invoices')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('transfers', function (Blueprint $table) {
            $table->dropConstrainedForeignId('target_invoice_id');
            $table->dropConstrainedForeignId('source_invoice_id');
            $table->dropColumn('kind');
        });
    }
};
