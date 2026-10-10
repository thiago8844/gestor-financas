<?php

namespace App\Http\Requests;

use App\Models\Conta;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

class TransferenciaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'from_account_id' => 'required|integer|exists:accounts,id',
            'to_account_id' => 'required|integer|exists:accounts,id|different:from_account_id',
            'amount' => 'required|numeric|min:0.01|max:999999999.99',
            'date' => 'required|date',
            'description' => 'nullable|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
            'from_account_id.required' => 'A conta de origem é obrigatória.',
            'from_account_id.exists' => 'A conta de origem não existe.',
            'to_account_id.required' => 'A conta de destino é obrigatória.',
            'to_account_id.exists' => 'A conta de destino não existe.',
            'to_account_id.different' => 'A conta de destino deve ser diferente da conta de origem.',
            'amount.required' => 'O valor é obrigatório.',
            'amount.min' => 'O valor deve ser maior que zero.',
            'amount.max' => 'O valor não pode exceder R$ 999.999.999,99.',
            'date.required' => 'A data é obrigatória.',
            'date.date' => 'A data deve ser uma data válida.',
            'description.max' => 'A descrição não pode exceder 255 caracteres.',
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            // exists:accounts não olha o dono — sem isso dava pra transferir de/para conta de outro usuário.
            $contas = Conta::where('user_id', Auth::id())
                ->whereIn('id', [$this->from_account_id, $this->to_account_id])
                ->pluck('id');

            if (!$contas->contains((int) $this->from_account_id)) {
                $validator->errors()->add('from_account_id', 'A conta de origem não existe.');
            }

            if (!$contas->contains((int) $this->to_account_id)) {
                $validator->errors()->add('to_account_id', 'A conta de destino não existe.');
            }
        });
    }
}
