<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class guest
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {

        // Verifica se o usuário está autenticado
        if (auth()->check()) {
            // Se o usuário estiver autenticado, redireciona para a página inicial
            return redirect()->route('dashboard');
        }

        return $next($request);
    }
}
