<?php

namespace App\Http\Requests\Conciliacao;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

class IniciarConciliacaoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'arquivo' => 'required|file|max:5120',
            'conta_id' => ['nullable', 'integer', Rule::exists('accounts', 'id')->where('user_id', Auth::id())],
            'mes' => ['nullable', 'date_format:Y-m'],
            'lembrar_conta' => 'nullable|boolean',
        ];
    }

    public function messages(): array
    {
        return [
            'arquivo.required' => 'Selecione o extrato (arquivo OFX) da conta.',
            'arquivo.file' => 'O arquivo enviado é inválido.',
            'arquivo.max' => 'O arquivo não pode exceder 5MB.',
            'conta_id.exists' => 'A conta selecionada não existe.',
            'mes.date_format' => 'Mês inválido.',
        ];
    }

    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $arquivo = $this->file('arquivo');

            if ($arquivo && !in_array(strtolower($arquivo->getClientOriginalExtension()), ['ofx', 'qfx'], true)) {
                $validator->errors()->add('arquivo', 'O extrato deve ser um arquivo .ofx ou .qfx.');
            }
        });
    }
}
