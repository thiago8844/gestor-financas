<?php

namespace App\Http\Controllers;

use App\Models\Categoria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CategoriaController extends Controller
{
    
    public function store(Request $request) {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
        ]);

        $category = new Categoria();
        $category->user_id = Auth::id();
        $category->name = $validated['name'];
        $category->save();

        return response()->json($category, 201);
    }
    //TODO: Implementar filtro de categorias mais utilizadas
    public function index() {
        $categories = Categoria::all();
        return response()->json($categories);
    }

    public function update() {

    }

}
