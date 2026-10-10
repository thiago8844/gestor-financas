<?php

namespace App\Http\Requests\Relatorios;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SimuladorFinanceiroRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->user()->id;

        return [
            // Como nos Compromissos Futuros, a projeção sempre começa hoje.
            'data_final' => 'required|date|after_or_equal:today|before_or_equal:' . now()->addMonths(37)->endOfMonth()->toDateString(),
            'conta_ids' => 'nullable|array',
            'conta_ids.*' => ['integer', Rule::exists('accounts', 'id')->where('user_id', $userId)],
            'cartao_ids' => 'nullable|array',
            'cartao_ids.*' => ['integer', Rule::exists('cards', 'id')->where('user_id', $userId)],
            'meses_historico' => 'nullable|integer|in:3,6,12,24',
            'estimar_variaveis' => 'nullable|boolean',
            'prever_despesas_variaveis' => 'nullable|boolean',
            'prever_receitas_variaveis' => 'nullable|boolean',
            ...self::regrasCenario('cenario', $userId),
        ];
    }

    /** Regras do cenário (também usadas ao salvar um cenário). */
    public static function regrasCenario(string $prefixo, int $userId): array
    {
        return [
            $prefixo => 'nullable|array',
            "{$prefixo}.inflacao_mensal" => 'nullable|numeric|min:-5|max:10',

            "{$prefixo}.ajustes" => 'nullable|array|max:100',
            "{$prefixo}.ajustes.*.id" => 'nullable|string|max:64',
            "{$prefixo}.ajustes.*.rotulo" => 'nullable|string|max:150',
            "{$prefixo}.ajustes.*.ativo" => 'nullable|boolean',
            "{$prefixo}.ajustes.*.alvo" => 'required|in:CATEGORIA,DESPESAS_ESTIMADAS,RECEITAS_ESTIMADAS,DESPESAS_RECORRENTES,RECEITAS_RECORRENTES,RECORRENCIA,CARTAO',
            "{$prefixo}.ajustes.*.tipo" => 'nullable|in:INCOME,EXPENSE',
            "{$prefixo}.ajustes.*.categoria_id" => ['nullable', 'integer', Rule::exists('categories', 'id')->where('user_id', $userId)],
            "{$prefixo}.ajustes.*.cartao_id" => ['nullable', 'integer', 'required_if:' . $prefixo . '.ajustes.*.alvo,CARTAO', Rule::exists('cards', 'id')->where('user_id', $userId)],
            "{$prefixo}.ajustes.*.recorrencia_id" => ['nullable', 'integer', 'required_if:' . $prefixo . '.ajustes.*.alvo,RECORRENCIA', Rule::exists('recurring_transactions', 'id')->where('user_id', $userId)],
            "{$prefixo}.ajustes.*.modo" => 'required|in:PERCENTUAL,DEFINIR,DELTA',
            "{$prefixo}.ajustes.*.valor" => 'required|numeric|min:-1000000|max:1000000',
            "{$prefixo}.ajustes.*.mes_inicio" => 'nullable|date_format:Y-m',
            "{$prefixo}.ajustes.*.mes_fim" => 'nullable|date_format:Y-m',

            "{$prefixo}.eventos" => 'nullable|array|max:50',
            "{$prefixo}.eventos.*.id" => 'nullable|string|max:64',
            "{$prefixo}.eventos.*.ativo" => 'nullable|boolean',
            "{$prefixo}.eventos.*.descricao" => 'required|string|max:150',
            "{$prefixo}.eventos.*.tipo" => 'required|in:INCOME,EXPENSE',
            "{$prefixo}.eventos.*.valor" => 'required|numeric|min:0.01|max:100000000',
            "{$prefixo}.eventos.*.data" => 'required|date',
            "{$prefixo}.eventos.*.categoria_id" => ['nullable', 'integer', Rule::exists('categories', 'id')->where('user_id', $userId)],
            "{$prefixo}.eventos.*.conta_id" => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('user_id', $userId)],
            "{$prefixo}.eventos.*.cartao_id" => ['nullable', 'integer', Rule::exists('cards', 'id')->where('user_id', $userId)],
            "{$prefixo}.eventos.*.parcelas" => 'nullable|integer|min:1|max:72',
            "{$prefixo}.eventos.*.frequencia" => 'nullable|in:WEEKLY,MONTHLY,YEARLY',
            "{$prefixo}.eventos.*.data_fim" => 'nullable|date',
        ];
    }

    public function messages(): array
    {
        return [
            'data_final.required' => 'A data final da simulação é obrigatória.',
            'data_final.after_or_equal' => 'A simulação precisa terminar hoje ou em uma data futura.',
            'data_final.before_or_equal' => 'A simulação pode ir no máximo 36 meses à frente.',
            'conta_ids.*.exists' => 'Uma das contas selecionadas não existe.',
            'cartao_ids.*.exists' => 'Um dos cartões selecionados não existe.',
            'meses_historico.in' => 'O histórico deve ser de 3, 6, 12 ou 24 meses.',
            'cenario.eventos.*.descricao.required' => 'Informe a descrição do evento simulado.',
            'cenario.eventos.*.valor.min' => 'O valor do evento simulado deve ser maior que zero.',
            'cenario.eventos.*.data.required' => 'Informe a data do evento simulado.',
        ];
    }
}
