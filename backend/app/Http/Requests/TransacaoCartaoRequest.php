<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class TransacaoCartaoRequest extends FormRequest
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
            'card_id' => [
                'required',
                'integer',
                Rule::exists('cards', 'id')->where('user_id', Auth::id()),
            ],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999.99'],
            'purchase_date' => ['required', 'date'],
            'installment_total' => ['nullable', 'integer', 'min:1', 'max:60'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'category_name' => ['nullable', 'string', 'max:100'],
            'budget_id' => ['nullable', 'integer', 'exists:budgets,id'],
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'card_id.required' => 'O cartão é obrigatório.',
            'card_id.exists' => 'O cartão informado não existe.',
            'description.required' => 'A descrição é obrigatória.',
            'amount.required' => 'O valor é obrigatório.',
            'amount.min' => 'O valor deve ser maior que zero.',
            'purchase_date.required' => 'A data da compra é obrigatória.',
            'installment_total.min' => 'O parcelamento deve ter pelo menos 1 parcela.',
            'installment_total.max' => 'O parcelamento não pode ter mais que 60 parcelas.',
        ];
    }
}
