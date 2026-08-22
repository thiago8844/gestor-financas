<?php

namespace App\Http\Requests;

use App\Enums\TransactionStatus;
use Illuminate\Foundation\Http\FormRequest;

class TransacaoParceladaRequest extends FormRequest
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
            'account_id' => 'required|integer|exists:accounts,id',
            'type' => 'required|in:INCOME,EXPENSE',
            'category_id' => 'nullable|integer|exists:categories,id',
            'category_name' => 'nullable|string|max:100',
            'description' => 'required|string|max:255',

            'installment_total' => 'required|integer|min:2|max:60',

            'parcelas' => "required|array|size:{$this->installment_total}",
            'parcelas.*.amount' => 'required|numeric|min:0.01|max:999999999.99',
            'parcelas.*.date' => 'nullable|date',
            'parcelas.*.due_date' => 'nullable|date',
            'parcelas.*.status' => 'required|in:PENDING,PAID',
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
            'type.required' => 'O tipo da transação é obrigatório.',
            'type.in' => 'O tipo deve ser INCOME ou EXPENSE.',
            'description.required' => 'A descrição é obrigatória.',
            'description.max' => 'A descrição não pode exceder 255 caracteres.',
            'installment_total.required' => 'O número de parcelas é obrigatório.',
            'installment_total.min' => 'O parcelamento deve ter pelo menos 2 parcelas.',
            'installment_total.max' => 'O parcelamento não pode ter mais que 60 parcelas.',
            'parcelas.required' => 'As parcelas são obrigatórias.',
            'parcelas.size' => 'A quantidade de parcelas informadas deve ser igual ao número total de parcelas.',
            'parcelas.*.amount.required' => 'O valor da parcela é obrigatório.',
            'parcelas.*.amount.min' => 'O valor da parcela deve ser maior que zero.',
            'parcelas.*.status.required' => 'O status da parcela é obrigatório.',
            'parcelas.*.status.in' => 'O status da parcela deve ser PENDING ou PAID.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $parcelas = $this->input('parcelas', []);

            foreach ($parcelas as $index => $parcela) {
                $status = $parcela['status'] ?? null;

                if ($status === TransactionStatus::PAID->value && empty($parcela['date'])) {
                    $validator->errors()->add(
                        "parcelas.{$index}.date",
                        'A data da transação é obrigatória quando a parcela está paga.'
                    );
                }
            }
        });
    }
}
