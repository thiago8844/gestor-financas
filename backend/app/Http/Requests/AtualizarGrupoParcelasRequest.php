<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AtualizarGrupoParcelasRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'description' => ['sometimes', 'string', 'max:255'],
            'category_id' => ['sometimes', 'nullable', 'integer', 'exists:categories,id'],
            'category_name' => ['sometimes', 'nullable', 'string', 'max:100'],
            'parcelas' => ['sometimes', 'array', 'min:1'],
            'parcelas.*.id' => ['required', 'integer'],
            'parcelas.*.amount' => ['sometimes', 'numeric', 'min:0.01', 'max:999999999.99'],
            // Conta corrente: novo vencimento da parcela.
            'parcelas.*.due_date' => ['sometimes', 'nullable', 'date'],
            // Cartão: mês de vencimento da fatura para onde a parcela vai (qualquer dia do mês).
            'parcelas.*.invoice_month' => ['sometimes', 'nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'description.max' => 'A descrição não pode exceder 255 caracteres.',
            'parcelas.*.id.required' => 'Informe a parcela que está sendo editada.',
            'parcelas.*.amount.min' => 'O valor da parcela deve ser maior que zero.',
            'parcelas.*.amount.numeric' => 'O valor da parcela é inválido.',
        ];
    }
}
