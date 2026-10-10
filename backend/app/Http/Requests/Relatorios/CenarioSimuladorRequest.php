<?php

namespace App\Http\Requests\Relatorios;

use Illuminate\Foundation\Http\FormRequest;

class CenarioSimuladorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
            'settings' => 'required|array',
            // Filtros salvos junto: horizonte (em meses ou data), contas, cartões e opções de estimativa.
            'settings.horizonte' => 'nullable',
            'settings.conta_ids' => 'nullable|array',
            'settings.cartao_ids' => 'nullable|array',
            'settings.meses_historico' => 'nullable|integer|in:3,6,12,24',
            'settings.estimar_variaveis' => 'nullable|boolean',
            'settings.prever_despesas_variaveis' => 'nullable|boolean',
            'settings.prever_receitas_variaveis' => 'nullable|boolean',
            ...SimuladorFinanceiroRequest::regrasCenario('settings.cenario', $this->user()->id),
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Dê um nome ao cenário.',
            'name.max' => 'O nome pode ter no máximo 100 caracteres.',
        ];
    }
}
