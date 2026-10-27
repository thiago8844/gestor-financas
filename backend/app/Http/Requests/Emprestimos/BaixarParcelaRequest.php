<?php

namespace App\Http\Requests\Emprestimos;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BaixarParcelaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => 'nullable|numeric|min:0.01|max:999999999.99',
            'paid_at' => 'nullable|date',
            'account_id' => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('user_id', $this->user()->id)],
        ];
    }
}
