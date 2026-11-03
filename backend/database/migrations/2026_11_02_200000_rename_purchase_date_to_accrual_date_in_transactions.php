<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * `purchase_date` (só preenchida em compras de cartão) vira `accrual_date`: a data de competência
     * do lançamento, o dia em que o gasto/ganho de fato aconteceu, independente de quando é pago ou
     * de quantas parcelas tem. Passa a existir em TODO lançamento (despesa ou receita, cartão ou conta).
     *
     * Quem já tinha data de compra mantém. Os demais recebem:
     *  - à vista: a data da transação (ou o vencimento / cadastro, se ainda pendente e sem data);
     *  - parcelados fora do cartão: a data mais antiga do grupo, igual em todas as parcelas.
     */
    public function up(): void
    {
        if (Schema::hasColumn('transactions', 'purchase_date') && ! Schema::hasColumn('transactions', 'accrual_date')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->renameColumn('purchase_date', 'accrual_date');
            });
        }

        if (! Schema::hasColumn('transactions', 'accrual_date')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->date('accrual_date')->nullable()->after('invoice_id');
            });
        }

        $this->preencherAvista();
        $this->preencherParcelados();
    }

    public function down(): void
    {
        if (Schema::hasColumn('transactions', 'accrual_date') && ! Schema::hasColumn('transactions', 'purchase_date')) {
            Schema::table('transactions', function (Blueprint $table) {
                $table->renameColumn('accrual_date', 'purchase_date');
            });
        }
    }

    private function preencherAvista(): void
    {
        DB::table('transactions')
            ->whereNull('accrual_date')
            ->whereNull('installment_group')
            ->update(['accrual_date' => DB::raw('DATE(COALESCE(date, due_date, created_at))')]);
    }

    private function preencherParcelados(): void
    {
        DB::table('transactions')
            ->whereNull('accrual_date')
            ->whereNotNull('installment_group')
            ->selectRaw('installment_group, MIN(DATE(COALESCE(date, due_date, created_at))) AS data')
            ->groupBy('installment_group')
            ->get()
            ->each(fn ($grupo) => DB::table('transactions')
                ->where('installment_group', $grupo->installment_group)
                ->whereNull('accrual_date')
                ->update(['accrual_date' => $grupo->data]));
    }
};
