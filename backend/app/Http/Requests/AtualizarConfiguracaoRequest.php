<?php

namespace App\Http\Requests;

use App\Models\ConfiguracaoUsuario;
use Illuminate\Foundation\Http\FormRequest;

class AtualizarConfiguracaoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $max = ConfiguracaoUsuario::DIAS_MAXIMO;

        return [
            'notify_upcoming_days' => "required|integer|min:0|max:{$max}",
            'auto_pay_invoices' => 'required|boolean',
            'notify_overdue_days' => "required|integer|min:0|max:{$max}",
        ];
    }

    public function messages(): array
    {
        $max = ConfiguracaoUsuario::DIAS_MAXIMO;

        return [
            'notify_upcoming_days.max' => "O aviso de vencimento pode ser de no máximo {$max} dias antes.",
            'notify_overdue_days.max' => "O aviso de atraso pode ser de no máximo {$max} dias depois.",
            'notify_upcoming_days.min' => 'Use 0 para desativar o aviso.',
            'notify_overdue_days.min' => 'Use 0 para desativar o aviso.',
        ];
    }
}
