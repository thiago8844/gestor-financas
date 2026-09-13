<?php

namespace App\Actions\Ofx;

use App\Enums\OfxImportItemStatus;
use App\Models\OfxImportItem;
use App\Models\OfxImportRule;

/**
 * Casa uma regra (descrição contém X + tipo opcional) contra os itens PENDENTE
 * de uma importação (ou de todas as importações do usuário) e aplica as ações
 * (descrição/categoria/orçamento) nos que derem match.
 */
class AplicarRegraOfx
{
    public function executar(OfxImportRule $regra, ?int $ofxImportId = null): int
    {
        $query = OfxImportItem::query()
            ->where('user_id', $regra->user_id)
            ->where('status', OfxImportItemStatus::PENDENTE);

        if ($ofxImportId) {
            $query->where('ofx_import_id', $ofxImportId);
        }

        $condicoes = $regra->conditions ?? [];
        $termo = mb_strtolower(trim($condicoes['descricao_contains'] ?? ''));
        $tipo = $condicoes['tipo'] ?? null;

        $itens = $query->get()->filter(function (OfxImportItem $item) use ($termo, $tipo) {
            if ($termo !== '' && !str_contains(mb_strtolower($item->descricao_original), $termo)) {
                return false;
            }

            if ($tipo && $item->type->value !== $tipo) {
                return false;
            }

            return true;
        });

        $acoes = $regra->actions ?? [];

        foreach ($itens as $item) {
            if (array_key_exists('descricao', $acoes)) {
                $item->descricao = $acoes['descricao'];
            }

            if (array_key_exists('category_id', $acoes)) {
                $item->category_id = $acoes['category_id'];
            }

            if (array_key_exists('budget_id', $acoes)) {
                $item->budget_id = $acoes['budget_id'];
            }

            $item->regra_aplicada_id = $regra->id;
            $item->save();
        }

        if ($itens->count() > 0) {
            $regra->increment('vezes_aplicada', $itens->count());
        }

        return $itens->count();
    }
}
