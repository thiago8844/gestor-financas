<?php

namespace Tests\Feature;

use App\Enums\OfxImportItemStatus;
use App\Models\Conta;
use App\Models\OfxImport;
use App\Models\Transacao;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class ImportacaoOfxTest extends TestCase
{
    use RefreshDatabase;

    private function fixture(string $nome): string
    {
        return file_get_contents(base_path('tests/Fixtures/Ofx/' . $nome));
    }

    private function arquivoFake(string $fixture, string $nomeUpload = 'extrato.ofx'): UploadedFile
    {
        return UploadedFile::fake()->createWithContent($nomeUpload, $this->fixture($fixture));
    }

    #[Test]
    public function upload_valido_cria_staging_com_contagens_corretas(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.total_transactions', 2);
        $response->assertJsonPath('data.status', 'STAGED');

        $this->assertDatabaseHas('ofx_imports', ['account_id' => $conta->id, 'total_transactions' => 2]);
        $this->assertDatabaseCount('ofx_import_items', 2);
        $this->assertDatabaseHas('ofx_import_items', [
            'fitid' => '2026080500001',
            'descricao_original' => 'PIX JOAO FERREIRA DA SILVA',
            'status' => OfxImportItemStatus::PENDENTE->value,
        ]);
    }

    #[Test]
    public function reimportar_o_mesmo_arquivo_e_bloqueado(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
        ])->assertStatus(201);

        $response = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
        ]);

        $response->assertStatus(409);
        $this->assertDatabaseCount('ofx_imports', 1);
    }

    #[Test]
    public function fitid_colidindo_com_transacao_existente_fica_marcado_como_duplicado(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        Transacao::create([
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
            'type' => 'EXPENSE',
            'amount' => 38,
            'status' => 'PAID',
            'date' => '2026-08-05',
            'due_date' => '2026-08-05',
            'fitid' => '2026080500001',
        ]);

        $response = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.duplicate_transactions', 1);

        $this->assertDatabaseHas('ofx_import_items', [
            'fitid' => '2026080500001',
            'status' => OfxImportItemStatus::DUPLICADA->value,
            'selecionada' => false,
        ]);
        $this->assertDatabaseHas('ofx_import_items', [
            'fitid' => '2026081000002',
            'status' => OfxImportItemStatus::PENDENTE->value,
            'selecionada' => true,
        ]);
    }

    #[Test]
    public function sem_conta_informada_e_sem_mapeamento_pede_para_selecionar_a_conta(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
        ]);

        $response->assertStatus(422);
        $response->assertJsonPath('necessita_conta', true);
        $response->assertJsonPath('banco_detectado.bank_id', '0001');
        $response->assertJsonPath('banco_detectado.acct_id', '1234567-8');

        $this->assertDatabaseCount('ofx_imports', 0);
    }

    #[Test]
    public function lembrar_conta_faz_a_proxima_importacao_do_mesmo_banco_associar_automaticamente(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
            'lembrar_conta' => true,
        ])->assertStatus(201);

        $this->assertDatabaseHas('ofx_account_mappings', [
            'user_id' => $conta->user_id,
            'account_id' => $conta->id,
        ]);

        // Segundo arquivo, mesmo banco/conta, sem informar conta_id explicitamente.
        $response = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1_segunda_remessa.ofx'),
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('data.account_id', $conta->id);
    }

    #[Test]
    public function edicao_inline_atualiza_descricao_mas_preserva_a_original(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $importacao = $this->criarImportacao($conta);
        $item = $importacao->itens()->where('status', OfxImportItemStatus::PENDENTE)->first();

        $response = $this->patchJson("/api/importacoes-ofx/{$importacao->id}/itens/{$item->id}", [
            'descricao' => 'Frutas na feira',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.descricao', 'Frutas na feira');
        $response->assertJsonPath('data.descricao_original', $item->descricao_original);

        $this->assertDatabaseHas('ofx_import_items', [
            'id' => $item->id,
            'descricao' => 'Frutas na feira',
            'descricao_original' => $item->descricao_original,
        ]);
    }

    #[Test]
    public function edicao_em_massa_so_afeta_os_ids_informados(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);
        $categoria = \App\Models\Categoria::create(['user_id' => $conta->user_id, 'name' => 'Alimentação']);

        $importacao = $this->criarImportacao($conta);
        $itens = $importacao->itens()->where('status', OfxImportItemStatus::PENDENTE)->get();
        $alvo = $itens->first();
        $outro = $itens->last();

        $response = $this->patchJson("/api/importacoes-ofx/{$importacao->id}/itens/em-massa", [
            'ids' => [$alvo->id],
            'category_id' => $categoria->id,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('ofx_import_items', ['id' => $alvo->id, 'category_id' => $categoria->id]);
        $this->assertDatabaseHas('ofx_import_items', ['id' => $outro->id, 'category_id' => null]);
    }

    #[Test]
    public function confirmar_cria_transacoes_apenas_para_os_selecionados_e_ignora_o_resto(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $importacao = $this->criarImportacao($conta);
        $itens = $importacao->itens()->where('status', OfxImportItemStatus::PENDENTE)->get();
        $selecionado = $itens->first();

        $response = $this->postJson("/api/importacoes-ofx/{$importacao->id}/confirmar", [
            'ids' => [$selecionado->id],
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'CONFIRMED');
        $response->assertJsonPath('data.imported_transactions', 1);
        $response->assertJsonPath('data.ignored_transactions', 1);

        $this->assertDatabaseHas('transactions', [
            'fitid' => $selecionado->fitid,
            'status' => 'PAID',
            'ofx_import_id' => $importacao->id,
        ]);
        $this->assertDatabaseHas('ofx_import_items', ['id' => $selecionado->id, 'status' => OfxImportItemStatus::IMPORTADA->value]);

        $naoSelecionado = $itens->last();
        $this->assertDatabaseHas('ofx_import_items', ['id' => $naoSelecionado->id, 'status' => OfxImportItemStatus::IGNORADA->value]);
        $this->assertDatabaseMissing('transactions', ['fitid' => $naoSelecionado->fitid]);
    }

    #[Test]
    public function desfazer_apaga_as_transacoes_criadas_quando_nada_foi_editado_depois(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $importacao = $this->criarImportacao($conta);
        $ids = $importacao->itens()->pluck('id')->all();

        $this->postJson("/api/importacoes-ofx/{$importacao->id}/confirmar", ['ids' => $ids])->assertStatus(200);
        $this->assertDatabaseCount('transactions', 2);

        $response = $this->postJson("/api/importacoes-ofx/{$importacao->id}/desfazer");

        $response->assertStatus(200);
        $response->assertJsonPath('data.status', 'UNDONE');
        $this->assertDatabaseCount('transactions', 0);
    }

    #[Test]
    public function desfazer_e_bloqueado_se_a_transacao_foi_editada_depois_a_menos_que_force(): void
    {
        $conta = Conta::factory()->create();
        Sanctum::actingAs($conta->user);

        $importacao = $this->criarImportacao($conta);
        $ids = $importacao->itens()->pluck('id')->all();

        $this->postJson("/api/importacoes-ofx/{$importacao->id}/confirmar", ['ids' => $ids])->assertStatus(200);

        $transacaoCriada = Transacao::where('ofx_import_id', $importacao->id)->first();
        $transacaoCriada->forceFill(['updated_at' => now()->addMinute()])->save();

        $bloqueado = $this->postJson("/api/importacoes-ofx/{$importacao->id}/desfazer");
        $bloqueado->assertStatus(409);
        $this->assertDatabaseCount('transactions', 2);

        $forcado = $this->postJson("/api/importacoes-ofx/{$importacao->id}/desfazer", ['forcar' => true]);
        $forcado->assertStatus(200);
        $this->assertDatabaseCount('transactions', 0);
    }

    #[Test]
    public function usuario_nao_pode_acessar_importacao_de_outro_usuario(): void
    {
        $conta = Conta::factory()->create();
        $outraConta = Conta::factory()->create();

        $importacao = $this->criarImportacao($conta);

        Sanctum::actingAs($outraConta->user);

        $response = $this->getJson("/api/importacoes-ofx/{$importacao->id}");

        $response->assertStatus(403);
    }

    private function criarImportacao(Conta $conta): OfxImport
    {
        Sanctum::actingAs($conta->user);

        $response = $this->postJson('/api/importacoes-ofx', [
            'arquivo' => $this->arquivoFake('checking_sgml_v1.ofx'),
            'conta_id' => $conta->id,
        ]);

        return OfxImport::find($response->json('data.id'));
    }
}
