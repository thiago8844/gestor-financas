<?php

namespace App\Http\Requests\Ofx;

use Illuminate\Foundation\Http\FormRequest;

class CriarRegraOfxRequest extends FormRequest
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
            'name' => 'nullable|string|max:255',
            'descricao_contains' => 'required|string|max:255',
            'tipo' => 'nullable|in:INCOME,EXPENSE',

            'descricao' => 'nullable|string|max:255',
            'category_id' => 'nullable|integer|exists:categories,id',
            'budget_id' => 'nullable|integer|exists:budgets,id',

            'ofx_import_id' => 'nullable|integer|exists:ofx_imports,id',
            'aplicar_ao_lote' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'descricao_contains.required' => 'Informe o texto que a descrição do OFX deve conter.',
            'tipo.in' => 'O tipo deve ser INCOME ou EXPENSE.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            if (!$this->filled('descricao') && !$this->filled('category_id') && !$this->filled('budget_id')) {
                $validator->errors()->add('descricao', 'Defina ao menos uma ação: descrição, categoria ou orçamento.');
            }
        });
    }
}
