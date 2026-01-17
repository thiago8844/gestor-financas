<?php

namespace App\Http\Controllers;

use App\Models\Categoria;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class CategoriaController extends Controller
{

    public function store(Request $request)
    {
        $request->merge([
            'name' => trim(mb_strtoupper($request->name)),
        ]);

        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:categories,name',
            'description' => 'nullable|string|max:1000',
        ]);

        $category = new Categoria();
        $category->user_id = Auth::id();
        $category->name = strtoupper($validated['name']);
        $category->save();

        return response()->json($category, 201);
    }

    public function destroy($id)
    {

        $categoria = Categoria::find($id);

        $categoria->delete();

        return response()->json(['success' => true]);
    }

    public function index()
    {

        $query = Categoria::query();

        $query->withCount([
            'transacoes as qtd_transacoes' => function ($q) {
                $q->where('user_id', Auth::id());
            }
        ]);
        $query->where('user_id', Auth::id())->orderBy('name');
        $categories = $query->get();

        return response()->json($categories);
    }

    public function update($id)
    {
        Categoria::find($id)->update([
            'name' => trim(mb_strtoupper(request()->name)),
        ]);

        return response()->json(['categoria' => Categoria::find($id), 'success' => true]);
    }
}
