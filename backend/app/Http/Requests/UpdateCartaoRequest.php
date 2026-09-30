<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class UpdateCartaoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $cartao = $this->route('cartao');

        return [
            'name' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('cards', 'name')
                    ->where('user_id', Auth::id())
                    ->ignore($cartao),
            ],
            'account_id' => [
                'sometimes',
                'integer',
                Rule::exists('accounts', 'id')->where('user_id', Auth::id()),
            ],
            'closing_day' => ['sometimes', 'integer', 'min:1', 'max:31'],
            'due_day' => ['sometimes', 'integer', 'min:1', 'max:31'],
            'active' => ['sometimes', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.unique' => 'Você já possui um cartão com esse nome.',
            'account_id.exists' => 'A conta informada não existe.',
            'closing_day.min' => 'O dia de fechamento deve ser entre 1 e 31.',
            'closing_day.max' => 'O dia de fechamento deve ser entre 1 e 31.',
            'due_day.min' => 'O dia de vencimento deve ser entre 1 e 31.',
            'due_day.max' => 'O dia de vencimento deve ser entre 1 e 31.',
        ];
    }
}
