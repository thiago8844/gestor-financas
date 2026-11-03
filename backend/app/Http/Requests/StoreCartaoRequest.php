<?php

namespace App\Http\Requests;

use App\Enums\RegraFechamentoCartao;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class StoreCartaoRequest extends FormRequest
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
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('cards', 'name')
                    ->where('user_id', Auth::id()),
            ],
            'account_id' => [
                'required',
                'integer',
                Rule::exists('accounts', 'id')->where('user_id', Auth::id()),
            ],
            'closing_rule' => ['sometimes', Rule::enum(RegraFechamentoCartao::class)],
            'closing_day' => ['required_unless:closing_rule,DAYS_BEFORE_DUE', 'nullable', 'integer', 'min:1', 'max:31'],
            'closing_days_before_due' => ['required_if:closing_rule,DAYS_BEFORE_DUE', 'nullable', 'integer', 'min:1', 'max:28'],
            'due_day' => ['required', 'integer', 'min:1', 'max:31'],
            'active' => ['boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'O nome do cartão é obrigatório.',
            'name.unique' => 'Você já possui um cartão com esse nome.',
            'account_id.required' => 'A conta usada para pagar o cartão é obrigatória.',
            'account_id.exists' => 'A conta informada não existe.',
            'closing_days_before_due.required_if' => 'Informe quantos dias antes do vencimento a fatura fecha.',
            'closing_days_before_due.min' => 'Informe entre 1 e 28 dias antes do vencimento.',
            'closing_days_before_due.max' => 'Informe entre 1 e 28 dias antes do vencimento.',
            'closing_day.required_unless' => 'O dia de fechamento é obrigatório.',
            'closing_day.min' => 'O dia de fechamento deve ser entre 1 e 31.',
            'closing_day.max' => 'O dia de fechamento deve ser entre 1 e 31.',
            'due_day.required' => 'O dia de vencimento é obrigatório.',
            'due_day.min' => 'O dia de vencimento deve ser entre 1 e 31.',
            'due_day.max' => 'O dia de vencimento deve ser entre 1 e 31.',
        ];
    }
}
