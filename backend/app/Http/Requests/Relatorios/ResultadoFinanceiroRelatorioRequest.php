<?php

namespace App\Http\Requests\Relatorios;

use Illuminate\Foundation\Http\FormRequest;

class ResultadoFinanceiroRelatorioRequest extends FormRequest
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
            'data_inicial' => 'required|date',
            'data_final' => 'required|date|after_or_equal:data_inicial',
            'conta_id' => 'nullable|integer|exists:accounts,id',
            'regime' => 'nullable|in:CAIXA,COMPETENCIA',
            'comparar_com' => 'nullable|in:NENHUM,PERIODO_ANTERIOR,MESMO_PERIODO_ANO_ANTERIOR',
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
        ];
    }
}
