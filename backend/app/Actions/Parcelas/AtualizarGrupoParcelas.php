<?php

namespace App\Actions\Parcelas;

use App\Actions\Faturas\ResolverFaturaCompra;
use App\Actions\Parcelas\Exceptions\GrupoParcelasException;
use App\Models\Categoria;
use App\Models\Fatura;
use App\Models\Transacao;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Edição em grupo de uma compra parcelada: valores, vencimentos (ou fatura, no cartão), descrição e
 * categoria de todas as parcelas de uma vez. Parcelas pagas ou já conciliadas com o extrato ficam
 * travadas para valor e data, porque mexer nelas descasaria saldo e auditoria.
 */
class AtualizarGrupoParcelas
{
    /** @return Collection<int, Transacao> */
    public static function carregar(int $userId, string $grupo): Collection
    {
        return Transacao::parcelasDoGrupo($grupo)
            ->where('user_id', $userId)
            ->with(['categoria', 'cartao', 'fatura'])
            ->get();
    }

    public static function travada(Transacao $parcela): bool
    {
        return $parcela->isPaga() || $parcela->reconciliation_item_id !== null;
    }

    /**
     * @param  array{description?: string, category_id?: ?int, category_name?: ?string,
     *               parcelas?: array<int, array{id: int, amount?: float, due_date?: ?string, invoice_month?: ?string}>}  $dados
     * @return Collection<int, Transacao>
     */
    public static function executar(int $userId, string $grupo, array $dados): Collection
    {
        $parcelas = static::carregar($userId, $grupo);

        if ($parcelas->isEmpty()) {
            throw new GrupoParcelasException('Grupo de parcelas não encontrado.');
        }

        $porId = $parcelas->keyBy('id');
        $noCartao = $parcelas->first()->card_id !== null;
        $alteracoes = [];
        $erros = [];

        foreach ($dados['parcelas'] ?? [] as $item) {
            /** @var Transacao|null $parcela */
            $parcela = $porId->get($item['id'] ?? null);

            if ($parcela === null) {
                throw new GrupoParcelasException('Uma das parcelas informadas não pertence a este grupo.');
            }

            $rotulo = "Parcela {$parcela->installment_number}/{$parcela->installment_total}";
            $mudancas = [];

            if (array_key_exists('amount', $item) && $item['amount'] !== null
                && (int) round(((float) $item['amount']) * 100) !== (int) round(((float) $parcela->amount) * 100)) {
                $mudancas['amount'] = round((float) $item['amount'], 2);
            }

            if ($noCartao) {
                if (!empty($item['invoice_month'])) {
                    $fatura = static::faturaDoMes($parcela, Carbon::parse($item['invoice_month'])->startOfMonth());

                    if ($fatura->id !== $parcela->invoice_id) {
                        if ($fatura->resumoValores()['paga'] && $fatura->parcelas()->exists()) {
                            $erros[] = "{$rotulo}: a fatura de destino já está paga.";
                        }

                        $mudancas['invoice_id'] = $fatura->id;
                        $mudancas['due_date'] = $fatura->due_date;
                    }
                }
            } elseif (!empty($item['due_date'])) {
                $novo = Carbon::parse($item['due_date']);

                if ($parcela->due_date === null || $parcela->due_date->toDateString() !== $novo->toDateString()) {
                    $mudancas['due_date'] = $novo;
                }
            }

            if ($mudancas !== [] && static::travada($parcela)) {
                $erros[] = "{$rotulo}: já está paga ou conciliada e não pode ter valor, vencimento ou fatura alterados.";

                continue;
            }

            if ($mudancas !== []) {
                $alteracoes[$parcela->id] = $mudancas;
            }
        }

        if ($erros !== []) {
            throw new GrupoParcelasException(implode(' ', $erros));
        }

        $comuns = static::camposComuns($userId, $dados);

        DB::transaction(function () use ($parcelas, $alteracoes, $comuns) {
            foreach ($parcelas as $parcela) {
                $campos = array_merge($comuns, $alteracoes[$parcela->id] ?? []);

                if ($campos !== []) {
                    $parcela->update($campos);
                }
            }
        });

        return static::carregar($userId, $grupo);
    }

    /**
     * Exclui o grupo inteiro. Recusa se qualquer parcela já foi paga ou conciliada.
     */
    public static function excluir(int $userId, string $grupo): int
    {
        $parcelas = static::carregar($userId, $grupo);

        if ($parcelas->isEmpty()) {
            throw new GrupoParcelasException('Grupo de parcelas não encontrado.');
        }

        $travadas = $parcelas->filter(fn (Transacao $p) => static::travada($p));

        if ($travadas->isNotEmpty()) {
            $numeros = $travadas->pluck('installment_number')->implode(', ');

            throw new GrupoParcelasException("O grupo tem parcelas pagas ou conciliadas ({$numeros}) e não pode ser excluído por inteiro.");
        }

        return DB::transaction(fn () => Transacao::whereIn('id', $parcelas->pluck('id'))->delete());
    }

    /** @return array<string, mixed> */
    protected static function camposComuns(int $userId, array $dados): array
    {
        $campos = [];

        if (!empty($dados['description'])) {
            $campos['description'] = $dados['description'];
        }

        if (!empty($dados['category_id'])) {
            $campos['category_id'] = $dados['category_id'];
        } elseif (!empty($dados['category_name'])) {
            $campos['category_id'] = Categoria::firstOrCreate([
                'user_id' => $userId,
                'name' => $dados['category_name'],
            ])->id;
        }

        return $campos;
    }

    /** A fatura é identificada pelo mês em que vence (reference_month), como aparece na tela. */
    protected static function faturaDoMes(Transacao $parcela, Carbon $referencia): Fatura
    {
        return ResolverFaturaCompra::localizarOuCriar(
            $parcela->cartao,
            ResolverFaturaCompra::cicloParaReferencia($parcela->cartao, $referencia),
        );
    }
}
