<?php

namespace App\Http\Requests\Relatorios;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AnaliseGastosRelatorioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'data_inicial' => 'required|date',
            'data_final' => 'required|date|after_or_equal:data_inicial|before_or_equal:' . now()->addYears(5)->toDateString(),
            'conta_ids' => 'nullable|array',
            'conta_ids.*' => ['integer', Rule::exists('accounts', 'id')->where('user_id', $this->user()->id)],
            // GASTO = data em que o gasto aconteceu (compra); PAGAMENTO = data em que o dinheiro sai (fatura/pagamento).
            'base_data' => 'nullable|in:GASTO,PAGAMENTO',
            'origem' => 'nullable|in:TODAS,CONTA,CARTAO',
            'estimar_variaveis' => 'nullable|boolean',
            'comparar' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'data_inicial.required' => 'A data inicial é obrigatória.',
            'data_final.required' => 'A data final é obrigatória.',
            'data_final.after_or_equal' => 'A data final não pode ser antes da data inicial.',
            'data_final.before_or_equal' => 'O período pode ir no máximo 5 anos à frente.',
            'conta_ids.*.exists' => 'Uma das contas selecionadas não existe.',
        ];
    }
}
