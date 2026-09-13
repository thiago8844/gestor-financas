<?php

namespace App\Http\Requests\Ofx;

use Illuminate\Foundation\Http\FormRequest;

class ImportarOfxRequest extends FormRequest
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
     */
    public function rules(): array
    {
        return [
            'arquivo' => 'required|file|max:5120',
            'conta_id' => 'nullable|integer|exists:accounts,id',
            'lembrar_conta' => 'nullable|boolean',
        ];
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'arquivo.required' => 'Selecione um arquivo OFX para importar.',
            'arquivo.file' => 'O arquivo enviado é inválido.',
            'arquivo.max' => 'O arquivo não pode exceder 5MB.',
            'conta_id.exists' => 'A conta selecionada não existe.',
        ];
    }

    /**
     * Configure the validator instance.
     */
    public function withValidator($validator)
    {
        $validator->after(function ($validator) {
            $arquivo = $this->file('arquivo');

            if ($arquivo && !in_array(strtolower($arquivo->getClientOriginalExtension()), ['ofx', 'qfx'])) {
                $validator->errors()->add('arquivo', 'O arquivo deve ter extensão .ofx ou .qfx.');
            }
        });
    }
}
