<?php

namespace App\Http\Requests\Emprestimos;

use App\Enums\DirecaoEmprestimo;
use App\Enums\FrequenciaEmprestimo;
use App\Enums\ModalidadeEmprestimo;
use App\Enums\PeriodoTaxa;
use App\Enums\TipoJuros;
use App\Support\Emprestimos\RegraVencimento;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Usada no cadastro e na prévia do cronograma (a prévia ignora conta/categoria).
 */
class EmprestimoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // O formulário manda texto vazio quando o campo não se aplica (ex.: prazo em aberto).
        foreach (['installments', 'due_day', 'rate'] as $campo) {
            if ($this->input($campo) === '') {
                $this->merge([$campo => null]);
            }
        }

        if ($this->input('interest_type') === TipoJuros::SEM_JUROS->value) {
            $this->merge(['rate' => 0]);
        }
    }

    public function rules(): array
    {
        $userId = $this->user()->id;
        $modalidade = $this->input('modality');

        return [
            'direction' => ['required', Rule::enum(DirecaoEmprestimo::class)],
            'counterparty' => 'required|string|max:150',
            'description' => 'nullable|string|max:255',
            'principal' => 'required|numeric|min:0.01|max:999999999.99',
            'contract_date' => 'required|date',

            'interest_type' => ['required', Rule::enum(TipoJuros::class)],
            'rate' => 'required_unless:interest_type,SEM_JUROS|nullable|numeric|min:0|max:1000',
            'rate_period' => ['required', Rule::enum(PeriodoTaxa::class)],
            'modality' => ['required', Rule::enum(ModalidadeEmprestimo::class)],

            'frequency' => ['nullable', Rule::enum(FrequenciaEmprestimo::class)],
            'due_day' => 'nullable|integer|between:1,31',
            'due_day_adjustment' => ['nullable', Rule::in([
                RegraVencimento::ULTIMO_DIA_MES,
                RegraVencimento::PROXIMO_DIA,
                RegraVencimento::ULTIMO_DIA_UTIL,
            ])],
            'first_due_date' => 'required|date',

            // Só os juros periódicos aceitam prazo em aberto; Price e SAC precisam do número de parcelas.
            'installments' => [
                in_array($modalidade, [ModalidadeEmprestimo::PRICE->value, ModalidadeEmprestimo::SAC->value], true)
                    ? 'required' : 'nullable',
                'integer', 'min:1', 'max:600',
            ],
            'grace_installments' => 'nullable|integer|min:0|max:599',

            'custom_installments' => [
                $modalidade === ModalidadeEmprestimo::LIVRE->value ? 'required' : 'nullable',
                'array', 'min:1', 'max:600',
            ],
            'custom_installments.*.due_date' => 'required|date',
            'custom_installments.*.principal_amount' => 'required|numeric|min:0',
            'custom_installments.*.interest_amount' => 'nullable|numeric|min:0',

            'account_id' => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('user_id', $userId)],
            'category_id' => ['nullable', 'integer', Rule::exists('categories', 'id')->where('user_id', $userId)],
            'category_name' => 'nullable|string|max:100',
            'movimentar_conta' => 'nullable|boolean',
            'notes' => 'nullable|string|max:2000',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($this->boolean('movimentar_conta') && !$this->filled('account_id')) {
                $validator->errors()->add('account_id', 'Informe a conta para movimentar o valor do empréstimo.');
            }
        });
    }
}
