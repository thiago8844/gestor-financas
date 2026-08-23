<?php

namespace App\Http\Requests;

use App\Enums\TransactionStatus;
use Illuminate\Foundation\Http\FormRequest;

class RecorrenciaTransacaoRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (!$this->filled('interval')) {
            $this->merge(['interval' => 1]);
        }
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'account_id' => 'required|integer|exists:accounts,id',
            'category_id' => 'nullable|integer|exists:categories,id',
            'category_name' => 'nullable|string|max:100',
            'type' => 'required|in:INCOME,EXPENSE',
            'description' => 'required|string|max:255',

            'amount' => 'nullable|numeric|min:0.01|max:999999999.99',
            'default_status' => 'required|in:PENDING,PAID',

            'frequency' => 'required|in:DAILY,WEEKLY,MONTHLY,YEARLY',
            'interval' => 'required|integer|min:1',

            'days_of_week' => 'required_if:frequency,WEEKLY|array|min:1',
            'days_of_week.*' => 'integer|between:0,6',

            'day_of_month' => 'required_if:frequency,MONTHLY,YEARLY|nullable|integer|between:1,31',
            'month_of_year' => 'required_if:frequency,YEARLY|nullable|integer|between:1,12',

            'start_date' => 'required|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',

            'active' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'account_id.required' => 'A conta é obrigatória.',
            'account_id.exists' => 'A conta selecionada não existe.',
            'type.required' => 'O tipo é obrigatório.',
            'description.required' => 'A descrição é obrigatória.',
            'amount.min' => 'O valor deve ser maior que zero.',
            'default_status.required' => 'Informe se a recorrência nasce paga ou pendente.',
            'frequency.required' => 'A frequência é obrigatória.',
            'interval.min' => 'O intervalo deve ser maior que zero.',
            'days_of_week.required_if' => 'Selecione pelo menos um dia da semana.',
            'day_of_month.required_if' => 'Informe o dia do mês.',
            'month_of_year.required_if' => 'Informe o mês do ano.',
            'start_date.required' => 'A data de início é obrigatória.',
            'end_date.after_or_equal' => 'A data final não pode ser antes da data de início.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            if ($this->input('default_status') === TransactionStatus::PAID->value && !$this->filled('amount')) {
                $validator->errors()->add(
                    'amount',
                    'Para a recorrência nascer paga, é preciso informar um valor fixo.'
                );
            }
        });
    }
}
