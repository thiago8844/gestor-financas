<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class TransacaoRequest extends FormRequest
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
            // Campos obrigatórios
            'account_id' => 'required|integer|exists:accounts,id',
            'amount' => 'required|numeric|min:0.01|max:999999999.99',
            'type' => 'required|in:INCOME,EXPENSE',
            'date' => 'required_if:status,PAID|date|nullable',
            'due_date' => 'nullable',
            'category_id' => 'nullable|integer|exists:categories,id',
            'category_name' => 'nullable|string|max:100',
            'description' => 'nullable|string|max:255',
            'status' => 'nullable|in:PENDING,PAID',
            
            // Parcelas (opcionais) TODO: MOVER PRA PARCELAMENTO REQUEST
            // 'is_installment' => 'nullable|boolean',
            // 'installment_number' => 'nullable|integer|min:1',
            // 'installment_total' => 'nullable|integer|min:1|gte:installment_number',
            // 'installment_group' => 'nullable|uuid',
            // 'due_date' => 'nullable|date',
            // 'paid_date' => 'nullable|date|required_if:status,PAID',

            //Recorrência
            // 'is_recurring' => 'nullable|boolean',
            // 'recurrence_id' => 'nullable|integer|exists:recurrences,id',
            // 'recurrence_end_date' => 'nullable|date|after:date',
            // 'recurrence_frequency' => 'nullable|in:DAILY,WEEKLY,MONTHLY,YEARLY',
            // 'recurrence_day' => 'nullable|integer|min:1|max:31',
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
            'amount.required' => 'O valor é obrigatório.',
            'amount.min' => 'O valor deve ser maior que zero.',
            'amount.max' => 'O valor não pode exceder R$ 999.999.999,99.',
            'type.required' => 'O tipo da transação é obrigatório.',
            'type.in' => 'O tipo deve ser INCOME ou EXPENSE.',
            'date.required' => 'A data é obrigatória.',
            'date.date' => 'A data deve ser uma data válida.',
            'description.max' => 'A descrição não pode exceder 255 caracteres.',
            'status.in' => 'O status deve ser PENDING ou PAID.',
            'installment_number.min' => 'O número da parcela deve ser maior que zero.',
            'installment_total.min' => 'O total de parcelas deve ser maior que zero.',
            'installment_total.gte' => 'O total de parcelas deve ser maior ou igual ao número da parcela.',
            'installment_group.uuid' => 'O grupo de parcelas deve ser um UUID válido.',
            'due_date.date' => 'A data de vencimento deve ser uma data válida.',
            'paid_date.date' => 'A data de pagamento deve ser uma data válida.',
            'paid_date.required_if' => 'A data de pagamento é obrigatória quando o status é PAID.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            // Validação customizada: se tem parcelas, deve ter número e total
            if ($this->has('installment_number') || $this->has('installment_total')) {
                if (!$this->has('installment_number') || !$this->has('installment_total')) {
                    $validator->errors()->add('installment', 'Para parcelamento, informe o número e total de parcelas.');
                }
            }
            
            // Validação customizada: se é parcela, deve ter grupo
            if ($this->has('installment_number') && $this->installment_number > 1) {
                if (!$this->has('installment_group')) {
                    $validator->errors()->add('installment_group', 'Parcelas múltiplas devem ter um grupo identificador.');
                }
            }
        });
    }
}