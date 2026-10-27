<?php

namespace App\Support\Emprestimos;

use App\Enums\FrequenciaEmprestimo;
use App\Enums\ModalidadeEmprestimo;
use App\Enums\PeriodoTaxa;
use App\Enums\TipoJuros;
use Carbon\Carbon;

/**
 * Parâmetros que definem o cronograma de um empréstimo. Existe separado do model para o
 * cálculo poder rodar sem banco (prévia do cadastro, testes).
 */
final class ContratoEmprestimo
{
    /**
     * @param array<int, array{due_date: string, principal_amount: float|int|string, interest_amount?: float|int|string}> $parcelasLivres
     */
    public function __construct(
        public readonly float $principal,
        public readonly float $taxa,
        public readonly PeriodoTaxa $periodoTaxa,
        public readonly TipoJuros $tipoJuros,
        public readonly ModalidadeEmprestimo $modalidade,
        public readonly FrequenciaEmprestimo $frequencia,
        public readonly Carbon $dataContratacao,
        public readonly Carbon $primeiroVencimento,
        public readonly ?int $diaVencimento = null,
        public readonly string $ajusteDia = RegraVencimento::ULTIMO_DIA_MES,
        public readonly ?int $parcelas = null,
        public readonly int $carencia = 0,
        public readonly array $parcelasLivres = [],
    ) {
    }

    public function prazoAberto(): bool
    {
        return $this->parcelas === null && $this->modalidade === ModalidadeEmprestimo::JUROS_PERIODICOS;
    }

    public static function dosDados(array $dados): self
    {
        $tipo = TipoJuros::from($dados['interest_type'] ?? TipoJuros::SIMPLES->value);

        return new self(
            principal: (float) $dados['principal'],
            taxa: $tipo === TipoJuros::SEM_JUROS ? 0.0 : (float) ($dados['rate'] ?? 0),
            periodoTaxa: PeriodoTaxa::from($dados['rate_period'] ?? PeriodoTaxa::MES->value),
            tipoJuros: $tipo,
            modalidade: ModalidadeEmprestimo::from($dados['modality']),
            frequencia: FrequenciaEmprestimo::from($dados['frequency'] ?? FrequenciaEmprestimo::MENSAL->value),
            dataContratacao: Carbon::parse($dados['contract_date'])->startOfDay(),
            primeiroVencimento: Carbon::parse($dados['first_due_date'])->startOfDay(),
            diaVencimento: isset($dados['due_day']) ? (int) $dados['due_day'] : null,
            ajusteDia: $dados['due_day_adjustment'] ?? RegraVencimento::ULTIMO_DIA_MES,
            parcelas: isset($dados['installments']) ? (int) $dados['installments'] : null,
            carencia: (int) ($dados['grace_installments'] ?? 0),
            parcelasLivres: $dados['custom_installments'] ?? [],
        );
    }
}
