<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OrcamentoRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'type' => 'required|in:ONE_TIME,RECURRING',
            'amount_limit' => 'nullable|numeric|min:0.01|max:999999999.99',
            'alert_percentage' => 'nullable|integer|min:1|max:100',
            'ignore_pending_installments' => 'nullable|boolean',
            'active' => 'nullable|boolean',

            'frequency' => 'nullable|in:WEEKLY,MONTHLY,YEARLY',
            'interval' => 'nullable|integer|min:1',
            'start_date' => 'nullable|date',

            'periodos' => 'nullable|array',
            'periodos.*.start_date' => 'required_with:periodos|date',
            'periodos.*.end_date' => 'required_with:periodos|date|after_or_equal:periodos.*.start_date',

            'limite_aplicar_a_partir' => 'nullable|in:atual,proximo',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'name.required' => 'O nome do orçamento é obrigatório.',
            'type.required' => 'O tipo do orçamento é obrigatório.',
            'type.in' => 'O tipo deve ser ONE_TIME ou RECURRING.',
            'amount_limit.min' => 'O limite deve ser maior que zero.',
            'alert_percentage.min' => 'O percentual de alerta deve ser entre 1 e 100.',
            'alert_percentage.max' => 'O percentual de alerta deve ser entre 1 e 100.',
            'periodos.*.end_date.after_or_equal' => 'A data final do intervalo não pode ser antes da data de início.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            if ($this->input('type') === 'RECURRING') {
                if (!$this->filled('frequency')) {
                    $validator->errors()->add('frequency', 'A frequência é obrigatória para orçamentos recorrentes.');
                }

                if (!$this->filled('start_date')) {
                    $validator->errors()->add('start_date', 'A data de início é obrigatória para orçamentos recorrentes.');
                }
            }

            if ($this->input('type') === 'ONE_TIME' && empty($this->input('periodos', []))) {
                $validator->errors()->add('periodos', 'Informe pelo menos um intervalo de datas.');
            }

            if ($this->filled('alert_percentage') && !$this->filled('amount_limit')) {
                $validator->errors()->add('alert_percentage', 'Defina um limite antes de configurar o alerta.');
            }
        });
    }
}
