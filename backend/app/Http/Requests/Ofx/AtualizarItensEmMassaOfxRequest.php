<?php

namespace App\Http\Requests\Ofx;

use Illuminate\Foundation\Http\FormRequest;

class AtualizarItensEmMassaOfxRequest extends FormRequest
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
     */
    public function rules(): array
    {
        return [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',

            'account_id' => 'nullable|integer|exists:accounts,id',
            'category_id' => 'nullable|integer|exists:categories,id',
            'budget_id' => 'nullable|integer|exists:budgets,id',
            'selecionada' => 'nullable|boolean',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            if (
                !$this->filled('account_id')
                && !$this->filled('category_id')
                && !$this->filled('budget_id')
                && is_null($this->input('selecionada'))
            ) {
                $validator->errors()->add('ids', 'Informe ao menos uma alteração a aplicar (conta, categoria, orçamento ou seleção).');
            }
        });
    }
}
