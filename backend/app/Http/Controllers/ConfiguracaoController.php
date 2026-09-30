<?php

namespace App\Http\Controllers;

use App\Http\Requests\AtualizarConfiguracaoRequest;
use App\Http\Resources\ConfiguracaoResource;
use App\Models\ConfiguracaoUsuario;
use Illuminate\Support\Facades\Auth;

class ConfiguracaoController extends Controller
{
    public function show()
    {
        return $this->resposta(ConfiguracaoUsuario::doUsuario(Auth::id()));
    }

    public function update(AtualizarConfiguracaoRequest $request)
    {
        $configuracao = ConfiguracaoUsuario::doUsuario(Auth::id());
        $dados = $request->validated();

        // Marca o dia em que a quitação automática foi ligada (ver migration). Desligar zera a marca.
        if ($dados['auto_pay_invoices'] && ! $configuracao->auto_pay_invoices) {
            $dados['auto_pay_invoices_since'] = now()->toDateString();
        } elseif (! $dados['auto_pay_invoices']) {
            $dados['auto_pay_invoices_since'] = null;
        }

        $configuracao->update($dados);

        return $this->resposta($configuracao);
    }

    // Sempre 200: o JsonResource responderia 201 quando o registro acabou de ser criado com os padrões.
    private function resposta(ConfiguracaoUsuario $configuracao)
    {
        return ConfiguracaoResource::make($configuracao)->response()->setStatusCode(200);
    }
}
