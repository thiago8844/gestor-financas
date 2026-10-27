<?php

namespace App\Http\Requests\Emprestimos;

use App\Models\EmprestimoAjuste;
use App\Support\Emprestimos\CalculadoraAjuste;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AjusteEmprestimoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in([EmprestimoAjuste::AMORTIZACAO, EmprestimoAjuste::AUMENTO])],
            'amount' => 'required|numeric|min:0.01|max:999999999.99',
            'date' => 'nullable|date',
            'mode' => ['nullable', Rule::in([CalculadoraAjuste::MANTER_PRAZO, CalculadoraAjuste::MANTER_PARCELA])],
            'installments' => 'nullable|integer|min:1|max:600',
            'account_id' => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('user_id', $this->user()->id)],
            'movimentar_conta' => 'nullable|boolean',
        ];
    }
}
