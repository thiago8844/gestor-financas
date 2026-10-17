<?php

namespace Tests\Unit;

use App\Enums\TransactionType;
use App\Support\Conciliacao\Conciliador;
use App\Support\Conciliacao\Dto\EntradaRazao;
use App\Support\Conciliacao\Dto\LinhaExtrato;
use App\Support\Conciliacao\NormalizadorDescricao;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

class ConciliadorTest extends TestCase
{
    private function linha(int $id, float $valor, string $data, string $descricao = '', TransactionType $tipo = TransactionType::EXPENSE): LinhaExtrato
    {
        return new LinhaExtrato($id, $tipo, $valor, Carbon::parse($data), $descricao);
    }

    private function entrada(string $chave, float $valor, string $data, string $descricao = '', TransactionType $tipo = TransactionType::EXPENSE): EntradaRazao
    {
        return new EntradaRazao($chave, EntradaRazao::ORIGEM_TRANSACAO, $tipo, $valor, Carbon::parse($data), $descricao, [1]);
    }

    #[Test]
    public function pareia_valor_exato_e_data_proxima_com_confianca_alta_quando_inequivoco(): void
    {
        $pares = (new Conciliador(4))->parear(
            [$this->linha(1, 87.40, '2026-08-12', 'PIX ENVIADO MERCADO SAO JOAO')],
            [$this->entrada('t:10', 87.40, '2026-08-11', 'Supermercado')]
        );

        $this->assertSame('t:10', $pares[1]['chave']);
        $this->assertSame(1, $pares[1]['dias']);
        $this->assertSame(Conciliador::ALTA, $pares[1]['confianca']);
    }

    #[Test]
    public function nao_pareia_tipo_diferente_valor_diferente_ou_fora_da_tolerancia(): void
    {
        $conciliador = new Conciliador(4);

        $this->assertSame([], $conciliador->parear(
            [$this->linha(1, 50, '2026-08-05')],
            [
                $this->entrada('t:1', 50, '2026-08-05', tipo: TransactionType::INCOME),
                $this->entrada('t:2', 50.01, '2026-08-05'),
                $this->entrada('t:3', 50, '2026-08-10'),
            ]
        ));
    }

    #[Test]
    public function valor_repetido_sem_descricao_que_desempate_vira_sugestao(): void
    {
        $pares = (new Conciliador(4))->parear(
            [$this->linha(1, 50, '2026-08-05', 'PIX FULANO')],
            [$this->entrada('t:1', 50, '2026-08-05', 'Almoço'), $this->entrada('t:2', 50, '2026-08-06', 'Uber')]
        );

        $this->assertSame('t:1', $pares[1]['chave']);
        $this->assertSame(Conciliador::MEDIA, $pares[1]['confianca']);
    }

    #[Test]
    public function descricao_parecida_desempata_e_garante_confianca_alta(): void
    {
        $pares = (new Conciliador(4))->parear(
            [$this->linha(1, 50, '2026-08-06', 'PIX ENVIADO UBER DO BRASIL')],
            [$this->entrada('t:1', 50, '2026-08-06', 'Almoço'), $this->entrada('t:2', 50, '2026-08-06', 'Uber')]
        );

        $this->assertSame('t:2', $pares[1]['chave']);
        $this->assertSame(Conciliador::ALTA, $pares[1]['confianca']);
    }

    #[Test]
    public function cada_lancamento_entra_em_um_par_so(): void
    {
        $pares = (new Conciliador(4))->parear(
            [$this->linha(1, 30, '2026-08-05', 'PADARIA'), $this->linha(2, 30, '2026-08-06', 'PADARIA')],
            [$this->entrada('t:1', 30, '2026-08-05', 'Padaria'), $this->entrada('t:2', 30, '2026-08-06', 'Padaria')]
        );

        $this->assertSame('t:1', $pares[1]['chave']);
        $this->assertSame('t:2', $pares[2]['chave']);
    }

    #[Test]
    public function candidatos_trazem_valor_exato_primeiro_e_depois_os_mais_proximos(): void
    {
        $candidatos = (new Conciliador(4))->candidatos(
            $this->linha(1, 100, '2026-08-05'),
            [
                $this->entrada('t:1', 98, '2026-08-05'),
                $this->entrada('t:2', 100, '2026-08-09'),
                $this->entrada('t:3', 150, '2026-08-05'),
                $this->entrada('t:4', 100, '2026-08-30'),
            ]
        );

        $this->assertSame(['t:2', 't:1', 't:3'], array_column($candidatos, 'chave'));
        $this->assertSame(-2.0, $candidatos[1]['diferenca']);
    }

    #[Test]
    public function similaridade_ignora_ruido_de_banco_acento_e_abreviacao(): void
    {
        $this->assertSame(1.0, NormalizadorDescricao::similaridade('PIX ENVIADO MERCADO SAO JOAO LTDA', 'Mercado São João'));
        $this->assertSame(1.0, NormalizadorDescricao::similaridade('PAG*MERC LIVRE', 'Mercado Livre'));
        $this->assertSame(0.0, NormalizadorDescricao::similaridade('PIX ENVIADO', 'Pagamento'));
    }
}
