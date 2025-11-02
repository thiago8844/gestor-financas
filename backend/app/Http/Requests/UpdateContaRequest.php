<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateContaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:255'],
            'active' => ['sometimes', 'boolean'],
            'include_in_networth' => ['sometimes', 'boolean'],
            'currency' => ['sometimes', 'string', 'max:10'],
            'instituicao' => ['nullable', 'string', 'max:255'],
            'saldo_inicial' => ['sometimes', 'numeric'],
            'data_saldo_inicial' => ['nullable', 'date'],
        ];
    }
}
