<?php

namespace App\Http\Requests\Relatorios;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CompromissosFuturosRelatorioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // A projeção sempre começa hoje; só o fim do horizonte é escolhido.
            'data_final' => 'required|date|after_or_equal:today|before_or_equal:' . now()->addYears(5)->toDateString(),
            'conta_ids' => 'nullable|array',
            'conta_ids.*' => ['integer', Rule::exists('accounts', 'id')->where('user_id', $this->user()->id)],
            'estimar_variaveis' => 'nullable|boolean',
            'tipos' => 'nullable|in:AMBOS,DESPESAS,RECEITAS',
        ];
    }

    public function messages(): array
    {
        return [
            'data_final.required' => 'A data final da projeção é obrigatória.',
            'data_final.after_or_equal' => 'A projeção precisa terminar hoje ou em uma data futura.',
            'data_final.before_or_equal' => 'A projeção pode ir no máximo 5 anos à frente.',
            'conta_ids.array' => 'As contas devem ser enviadas como uma lista.',
            'conta_ids.*.exists' => 'Uma das contas selecionadas não existe.',
            'estimar_variaveis.boolean' => 'A opção de estimar valores variáveis é inválida.',
        ];
    }
}
