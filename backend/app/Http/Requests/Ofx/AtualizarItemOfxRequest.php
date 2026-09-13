<?php

namespace App\Http\Requests\Ofx;

use Illuminate\Foundation\Http\FormRequest;

class AtualizarItemOfxRequest extends FormRequest
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
            'descricao' => 'nullable|string|max:255',
            'account_id' => 'nullable|integer|exists:accounts,id',
            'category_id' => 'nullable|integer|exists:categories,id',
            'budget_id' => 'nullable|integer|exists:budgets,id',
            'selecionada' => 'nullable|boolean',
        ];
    }
}
