<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('loans', function (Blueprint $table) {
            $table->id();

            $table->foreignId('user_id')->constrained()->onDelete('cascade');

            $table->enum('direction', ['TOMADO', 'CONCEDIDO'])->comment('TOMADO = eu devo; CONCEDIDO = me devem');
            $table->string('counterparty', 150)->comment('Pessoa ou instituição');
            $table->string('description', 255)->nullable();

            $table->decimal('principal', 12, 2);
            $table->date('contract_date');

            $table->decimal('rate', 10, 6)->default(0);
            $table->enum('rate_period', ['DIA', 'MES', 'ANO'])->default('MES');
            $table->enum('interest_type', ['SIMPLES', 'COMPOSTO', 'SEM_JUROS'])->default('SIMPLES');
            $table->enum('modality', ['JUROS_PERIODICOS', 'PRICE', 'SAC', 'PAGAMENTO_UNICO', 'LIVRE']);

            $table->enum('frequency', ['MENSAL', 'QUINZENAL', 'SEMANAL', 'ANUAL'])->default('MENSAL');
            $table->unsignedTinyInteger('due_day')->nullable()->comment('Dia do mês fixo (só MENSAL)');
            $table->enum('due_day_adjustment', ['ULTIMO_DIA_MES', 'PROXIMO_DIA', 'ULTIMO_DIA_UTIL'])
                ->default('ULTIMO_DIA_MES')
                ->comment('O que fazer quando o dia não existe no mês ou cai no fim de semana');
            $table->date('first_due_date');
            $table->unsignedSmallInteger('installments')->nullable()->comment('Null = prazo em aberto');
            $table->unsignedSmallInteger('grace_installments')->default(0)->comment('Parcelas iniciais só de juros');

            $table->foreignId('account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('categories')->nullOnDelete();

            $table->enum('status', ['ATIVO', 'QUITADO', 'CANCELADO'])->default('ATIVO');
            $table->text('notes')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loans');
    }
};
