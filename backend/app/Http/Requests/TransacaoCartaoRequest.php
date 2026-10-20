<?php

namespace App\Http\Requests;

use App\Support\DividirParcelas;
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
            // INCOME = crédito/estorno na fatura (abate do total). Sem o campo, continua sendo compra.
            'type' => ['nullable', Rule::in(['EXPENSE', 'INCOME'])],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:999999999.99'],
            'purchase_date' => ['required', 'date'],
            'installment_total' => ['nullable', 'integer', 'min:1', 'max:60'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'category_name' => ['nullable', 'string', 'max:100'],
            'budget_id' => ['nullable', 'integer', 'exists:budgets,id'],
            // Onde caem os centavos que sobram da divisão (cada banco/vendedor faz de um jeito).
            'modo_centavos' => ['nullable', Rule::in(DividirParcelas::MODOS)],
            // Valores exatos de cada parcela, quando conferidos com o banco. Opcional: sem ele o total é dividido.
            'parcelas' => ['nullable', 'array'],
            'parcelas.*.amount' => ['required_with:parcelas', 'numeric', 'min:0.01', 'max:999999999.99'],
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
            'modo_centavos.in' => 'O modo de distribuição dos centavos é inválido.',
            'parcelas.*.amount.required_with' => 'O valor da parcela é obrigatório.',
            'parcelas.*.amount.min' => 'O valor da parcela deve ser maior que zero.',
            'type.in' => 'O tipo deve ser compra (EXPENSE) ou crédito (INCOME).',
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            if ($this->input('type') === 'INCOME' && (int) $this->input('installment_total', 1) > 1) {
                $validator->errors()->add('installment_total', 'Crédito/estorno no cartão não pode ser parcelado.');
            }

            $parcelas = $this->input('parcelas');

            if (!is_array($parcelas) || $parcelas === []) {
                return;
            }

            if (count($parcelas) !== (int) $this->input('installment_total', 1)) {
                $validator->errors()->add('parcelas', 'A quantidade de parcelas informadas deve ser igual ao número de parcelas.');

                return;
            }

            $soma = DividirParcelas::somaEmCentavos(array_column($parcelas, 'amount'));
            $total = (int) round(((float) $this->input('amount')) * 100);

            if ($soma !== $total) {
                $diferenca = number_format(abs($soma - $total) / 100, 2, ',', '.');
                $validator->errors()->add('parcelas', "A soma das parcelas não confere com o valor total (diferença de R$ {$diferenca}).");
            }
        });
    }
}
