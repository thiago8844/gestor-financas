<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DespesaRequest extends FormRequest
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
            'descricao' => 'required|string|max:255',
            'valor' => 'required|numeric|gt:0',
            'data' => 'required|date',
            'conta' => 'required|exists:conta,id',
            'categoria' => 'nullable|exists:categorias,id',
            'orcamento' => 'nullable|exists:orcamentos,id',
        ];
    }
}
