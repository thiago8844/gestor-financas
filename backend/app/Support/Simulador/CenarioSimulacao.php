<?php

namespace App\Support\Simulador;

/**
 * Tudo que o usuário mexeu no simulador — e NADA além disso. É só configuração: aplicar um
 * cenário nunca altera lançamentos, recorrências ou faturas reais (por isso pode ser salvo,
 * reaplicado sobre os dados de hoje e descartado à vontade).
 *
 * Ajustes (`ajustes`), cada um com período opcional (mes_inicio / mes_fim, 'Y-m', inclusive):
 *  - CATEGORIA (tipo + categoria_id): PERCENTUAL, DEFINIR (total mensal) ou DELTA (R$/mês) sobre a
 *    estimativa de consumo da categoria — antes de descontar o que já está cadastrado.
 *  - DESPESAS_ESTIMADAS / RECEITAS_ESTIMADAS: PERCENTUAL ou DELTA sobre todas as estimativas do tipo.
 *  - DESPESAS_RECORRENTES / RECEITAS_RECORRENTES / RECORRENCIA (recorrencia_id): PERCENTUAL sobre as
 *    ocorrências FUTURAS de recorrências (ainda não materializadas) — ex.: aumento de salário.
 *  - CARTAO (cartao_id): PERCENTUAL sobre as compras ESTIMADAS daquele cartão.
 * Compras reais e parcelas já contratadas nunca são ajustáveis.
 *
 * Eventos hipotéticos (`eventos`): receitas/despesas que só existem na simulação, à vista, parceladas
 * (conta ou cartão) ou recorrentes.
 */
final class CenarioSimulacao
{
    public const ALVOS_ESTIMATIVA = ['CATEGORIA', 'DESPESAS_ESTIMADAS', 'RECEITAS_ESTIMADAS'];

    public function __construct(
        /** Inflação mensal (%) aplicada às despesas estimadas, composta mês a mês. */
        public readonly float $inflacaoMensal = 0.0,
        /** @var array<int, array> */
        public readonly array $ajustes = [],
        /** @var array<int, array> */
        public readonly array $eventos = [],
    ) {
    }

    public static function fromArray(?array $dados): self
    {
        $dados ??= [];

        $ajustes = [];
        foreach ($dados['ajustes'] ?? [] as $i => $ajuste) {
            if (isset($ajuste['ativo']) && !filter_var($ajuste['ativo'], FILTER_VALIDATE_BOOLEAN)) {
                continue;
            }

            $ajustes[] = [
                'id' => (string) ($ajuste['id'] ?? "ajuste-{$i}"),
                'rotulo' => $ajuste['rotulo'] ?? null,
                'alvo' => $ajuste['alvo'],
                'tipo' => $ajuste['tipo'] ?? null,
                'categoria_id' => isset($ajuste['categoria_id']) && $ajuste['categoria_id'] !== '' ? (int) $ajuste['categoria_id'] : null,
                'cartao_id' => isset($ajuste['cartao_id']) ? (int) $ajuste['cartao_id'] : null,
                'recorrencia_id' => isset($ajuste['recorrencia_id']) ? (int) $ajuste['recorrencia_id'] : null,
                'modo' => $ajuste['modo'] ?? 'PERCENTUAL',
                'valor' => (float) ($ajuste['valor'] ?? 0),
                'mes_inicio' => $ajuste['mes_inicio'] ?? null,
                'mes_fim' => $ajuste['mes_fim'] ?? null,
            ];
        }

        $eventos = [];
        foreach ($dados['eventos'] ?? [] as $i => $evento) {
            if (isset($evento['ativo']) && !filter_var($evento['ativo'], FILTER_VALIDATE_BOOLEAN)) {
                continue;
            }

            $eventos[] = [
                'id' => (string) ($evento['id'] ?? "evento-{$i}"),
                'descricao' => (string) ($evento['descricao'] ?? 'Evento simulado'),
                'tipo' => $evento['tipo'],
                'valor' => round((float) $evento['valor'], 2),
                'data' => $evento['data'],
                'categoria_id' => isset($evento['categoria_id']) ? (int) $evento['categoria_id'] : null,
                'conta_id' => isset($evento['conta_id']) ? (int) $evento['conta_id'] : null,
                'cartao_id' => isset($evento['cartao_id']) && $evento['tipo'] === 'EXPENSE' ? (int) $evento['cartao_id'] : null,
                'parcelas' => max(1, (int) ($evento['parcelas'] ?? 1)),
                'frequencia' => $evento['frequencia'] ?? null,
                'data_fim' => $evento['data_fim'] ?? null,
            ];
        }

        return new self(
            inflacaoMensal: (float) ($dados['inflacao_mensal'] ?? 0),
            ajustes: $ajustes,
            eventos: $eventos,
        );
    }

    public function vazio(): bool
    {
        return $this->inflacaoMensal == 0.0 && $this->ajustes === [] && $this->eventos === [];
    }

    /** O mesmo cenário sem um ajuste/evento — para medir o impacto isolado daquela decisão. */
    public function sem(string $id): self
    {
        return new self(
            $id === 'inflacao' ? 0.0 : $this->inflacaoMensal,
            array_values(array_filter($this->ajustes, fn ($a) => $a['id'] !== $id)),
            array_values(array_filter($this->eventos, fn ($e) => $e['id'] !== $id)),
        );
    }

    public function com(array $ajuste): self
    {
        return new self($this->inflacaoMensal, [...$this->ajustes, $ajuste], $this->eventos);
    }

    /** @return array<int, array{id: string, rotulo: string}> as decisões do usuário, para medir impactos */
    public function decisoes(): array
    {
        $decisoes = [];

        if ($this->inflacaoMensal != 0.0) {
            $decisoes[] = ['id' => 'inflacao', 'rotulo' => 'Inflação de ' . number_format($this->inflacaoMensal, 2, ',', '.') . '% ao mês nas despesas estimadas'];
        }

        foreach ($this->ajustes as $ajuste) {
            $decisoes[] = ['id' => $ajuste['id'], 'rotulo' => $ajuste['rotulo'] ?? 'Ajuste'];
        }

        foreach ($this->eventos as $evento) {
            $decisoes[] = ['id' => $evento['id'], 'rotulo' => $evento['descricao']];
        }

        return $decisoes;
    }

    public static function vigente(array $ajuste, string $mes): bool
    {
        return ($ajuste['mes_inicio'] === null || $mes >= $ajuste['mes_inicio'])
            && ($ajuste['mes_fim'] === null || $mes <= $ajuste['mes_fim']);
    }
}
