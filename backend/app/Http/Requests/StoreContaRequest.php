<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class StoreContaRequest extends FormRequest
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
                Rule::unique('accounts', 'name')
                    ->where('user_id', Auth::id()),
            ],
            'type' => ['required', 'in:EXPENSE,INCOME'],
            'active' => ['boolean'],
            'include_in_networth' => ['boolean'],
            'currency' => ['required', 'string', 'max:10'],
            'instituicao' => ['nullable', 'string', 'max:255'],
            'saldo_inicial' => ['nullable', 'numeric'],
            'data_saldo_inicial' => ['nullable', 'date'],
        ];
    }

    public function messages(): array
    {
        return [
            'user_id.required' => 'O campo usuário é obrigatório.',
            'user_id.exists' => 'O usuário informado não existe.',
            'name.required' => 'O nome da conta é obrigatório.',
            'type.required' => 'O tipo da conta é obrigatório.',
            'type.in' => 'O tipo da conta deve ser EXPENSE ou INCOME.',
            'role.required' => 'O papel da conta é obrigatório.',
            'currency.required' => 'A moeda é obrigatória.',
        ];
    }
}
