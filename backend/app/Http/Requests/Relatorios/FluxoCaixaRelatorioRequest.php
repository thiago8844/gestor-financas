<?php

namespace App\Http\Requests\Relatorios;

use Illuminate\Foundation\Http\FormRequest;

class FluxoCaixaRelatorioRequest extends FormRequest
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
            // Período — obrigatório, define o recorte do relatório
            'data_inicial' => 'required|date',
            'data_final' => 'required|date|after_or_equal:data_inicial',

            // Filtros principais
            'conta_id' => 'nullable|integer|exists:accounts,id',
            'regime' => 'nullable|in:CAIXA,COMPETENCIA',
            'comparar_com' => 'nullable|in:NENHUM,PERIODO_ANTERIOR,MESMO_PERIODO_ANO_ANTERIOR',
            'agrupamento' => 'nullable|in:DAILY,WEEKLY,MONTHLY',

            // Mais filtros
            'category_id' => 'nullable|integer|exists:categories,id',
            'budget_id' => 'nullable|integer|exists:budgets,id',
            'type' => 'nullable|in:INCOME,EXPENSE',
            'status' => 'nullable|in:PAID,PENDING',
            'valor_minimo' => 'nullable|numeric|min:0',
            'valor_maximo' => 'nullable|numeric|gte:valor_minimo',
            'descricao' => 'nullable|string|max:255',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'data_inicial.required' => 'A data inicial é obrigatória.',
            'data_final.required' => 'A data final é obrigatória.',
            'data_final.after_or_equal' => 'A data final não pode ser antes da data inicial.',
            'conta_id.exists' => 'A conta selecionada não existe.',
            'regime.in' => 'O regime deve ser CAIXA ou COMPETENCIA.',
            'valor_maximo.gte' => 'O valor máximo deve ser maior ou igual ao valor mínimo.',
        ];
    }
}
