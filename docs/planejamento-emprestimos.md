# Planejamento — Módulo de Empréstimos

> Escrito para: você (dono do projeto) validar o escopo antes da implementação.
> Status: **planejamento** — nenhum código foi alterado.

---

## 1) Objetivo

Controlar empréstimos nas duas direções:

- **Eu devo** (`tomado`): dinheiro que peguei emprestado. Cada parcela vira uma **despesa** quando paga.
- **Me devem** (`concedido`): dinheiro que emprestei. Cada parcela recebida vira uma **receita** quando recebida.

O módulo precisa ser simples para quem só quer "registrar que emprestei R$ 5.000" e completo para quem quer simular, antecipar, cobrar atrasos e ver o custo real de cada contrato.

### Caso de referência (critério de aceite)

> Emprestei **R$ 5.000** a **2% ao mês, juros simples**. Todo dia **26** a partir de **26/11/2026** a pessoa paga **R$ 100** (só juros). O principal de R$ 5.000 é devolvido no fim do contrato.

Cálculo: `5.000 × 2% = 100` por mês. O principal não amortiza durante o contrato — a modalidade é **"juros periódicos, principal no fim"**. O sistema deve:

1. Gerar as parcelas de R$ 100 em 26/11, 26/12, 26/01…
2. Mostrar a data de encerramento do contrato (ou "prazo em aberto", ver seção 4).
3. Notificar antes de cada vencimento e quando atrasar.
4. Permitir marcar cada parcela como **paga** (com conta e data) ou **não paga**.
5. Ao marcar como paga, criar uma **receita** na conta escolhida.

---

## 2) Decisões já tomadas (podem ser revistas)

| Tema | Decisão padrão | Motivo |
| --- | --- | --- |
| Taxa "2%" | Ao **mês**, salvo indicação contrária | É o que bate com R$ 100 mensais |
| Principal | Modalidade padrão "juros periódicos, principal no fim" | Caso de referência |
| Baixa de pagamento | **Manual** no MVP. Automática como opção por contrato na Fase 2 | Evita lançar dinheiro que não entrou |
| Dinheiro recebido ao tomar emprestado | Opção "creditar na conta" ao contratar (padrão: sim) | Mantém o saldo da conta correto |
| Juros proporcionais (dias) | Base 30 dias por mês (configurável para 365 dias por ano) | Padrão de mercado, simples de explicar |
| Arredondamento | Centavos; a **última parcela absorve a diferença** | Soma sempre bate com o total |
| Vínculo com o restante do sistema | Reutilizar `transactions` (com FK nova), igual a `invoice_id`, `budget_id`, `recurring_transaction_id` | Consistência com o que já existe |

---

## 3) Modelo de dados

### 3.1 `emprestimos`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | bigint | |
| `user_id` | FK users | |
| `direcao` | enum `tomado` / `concedido` | Eu devo / Me devem |
| `contraparte` | string | Nome da pessoa ou instituição |
| `descricao` | string, nullable | Ex.: "Empréstimo do carro" |
| `valor_principal` | valor (mesma convenção de `transactions`) | Valor emprestado |
| `data_contratacao` | date | |
| `taxa` | decimal(10,6) | Ex.: 2.000000 |
| `periodo_taxa` | enum `dia` / `mes` / `ano` | Período da taxa |
| `tipo_juros` | enum `simples` / `composto` / `sem_juros` | |
| `modalidade` | enum (ver seção 4.2) | Define o cronograma |
| `carencia_parcelas` | smallint, default 0 | Quantas parcelas só de juros no início |
| `num_parcelas` | smallint, nullable | Null = prazo em aberto |
| `data_primeiro_vencimento` | date | |
| `regra_vencimento` | json | Ex.: `{"tipo":"dia_mes","dia":26,"ajuste":"ultimo_dia_util"}` |
| `frequencia` | enum `mensal` / `quinzenal` / `semanal` / `anual` / `dias` | Fase 1 só `mensal` |
| `multa_atraso_percentual` | decimal, default 0 | Fase 2 |
| `juros_mora_mensal_percentual` | decimal, default 0 | Fase 2 |
| `conta_id` | FK contas, nullable | Conta padrão para lançar as baixas |
| `categoria_id` | FK categorias, nullable | Padrão: categoria "Empréstimos" |
| `modo_baixa` | enum `manual` / `automatica` | Automática só na Fase 2 |
| `status` | enum `ativo` / `quitado` / `cancelado` | Atrasado é **calculado**, não gravado |
| `observacoes` | text, nullable | |
| `timestamps` | | |

### 3.2 `emprestimo_parcelas`

| Campo | Tipo | Observação |
| --- | --- | --- |
| `id` | bigint | |
| `emprestimo_id` | FK, cascade | |
| `numero` | smallint | 1, 2, 3… |
| `vencimento` | date | |
| `valor_principal` | valor | Parte que amortiza saldo devedor |
| `valor_juros` | valor | |
| `valor_previsto` | valor | principal + juros |
| `valor_pago` | valor, default 0 | Permite pagamento parcial |
| `pago_em` | date, nullable | |
| `status` | enum `prevista` / `paga` / `parcial` / `cancelada` | Atraso é calculado pelo vencimento |
| `transacao_id` | FK transactions, nullable | Lançamento gerado na baixa |
| `ajuste_mora` | valor, default 0 | Fase 2 |

Índices: `(emprestimo_id, numero)` único; `(vencimento, status)` para notificações.

### 3.3 `emprestimo_eventos` (histórico)

Registra criação, pagamento, reversão, antecipação e edição de cronograma. Necessário para auditoria, no mesmo espírito de `invoice_audits` já existente.

### 3.4 Alteração em `transactions`

- Nova coluna `emprestimo_parcela_id` (nullable, FK).
- Lançamentos gerados por empréstimo não podem ser editados/excluídos sem passar pelo módulo (mesma regra usada para faturas e conciliação).

---

## 4) Motor de cálculo (backend)

Um **serviço puro** (sem banco), por exemplo `App\Support\Emprestimos\GeradorCronograma`, recebe o contrato e devolve as parcelas. Isso permite testar toda a matemática com PHPUnit sem tocar no banco.

### 4.1 Juros

| Caso | Fórmula |
| --- | --- |
| Simples, por período | `juros = saldo × i` |
| Simples, total | `juros = P × i × n` |
| Composto | `saldo_k = saldo_(k-1) × (1 + i)` |
| Conversão a.a. → a.m. (composto) | `i_m = (1 + i_a)^(1/12) − 1` |
| Conversão a.a. → a.m. (simples) | `i_m = i_a / 12` |
| Dia → mês (base 30) | `i_m = i_d × 30` |
| Juros proporcionais (fração de período) | `juros = saldo × i × (dias / base)` |

### 4.2 Modalidades (cronogramas)

| Modalidade | Como funciona | Exemplo |
| --- | --- | --- |
| **Juros periódicos, principal no fim** (padrão) | Paga só juros em cada período; principal no vencimento final | Caso de referência |
| **Parcelado — Price** | Parcela fixa; juros decrescem, principal cresce | Financiamento, crédito pessoal |
| **Parcelado — SAC** | Amortização constante; parcela decresce | Financiamento imobiliário |
| **Pagamento único** | Principal + juros acumulados em uma data | "Te pago tudo em março" |
| **Parcelas livres** | Sem fórmula; o usuário digita cada valor | Acordo informal |

Carência: as primeiras `carencia_parcelas` são só juros (ou nada, se composto e configurado para capitalizar).

Prazo em aberto (`num_parcelas = null`): gera parcelas por 12 meses à frente, e o sistema pede a data de encerramento quando o usuário quiser fechar o contrato.

### 4.3 Regras de vencimento

- **Dia fixo do mês** (ex.: dia 26). Quando o dia não existe (fev 30), ajuste configurável: último dia do mês, dia seguinte ou último dia útil.
- **Dias corridos** (ex.: a cada 15 dias) — Fase 2.
- **Dias úteis e feriados** — Fase 3 (exige calendário de feriados).

### 4.4 Operações sobre o contrato (Fase 2)

- **Pagamento antecipado**: calcula desconto de juros futuros (simples ou composto, configurável) e mostra o valor exato antes de confirmar.
- **Amortização extra**: reduz o saldo devedor e recalcula o cronograma. Usuário escolhe: *reduzir prazo* ou *reduzir parcela*.
- **Renegociação**: encerra o contrato atual e cria outro vinculado a ele (`contrato_origem_id`).
- **Atraso**: `valor_atualizado = valor_previsto + multa + juros_mora × dias_atraso/30`.

---

## 5) Regras de status

- `prevista`: vencimento no futuro.
- `paga`: `valor_pago >= valor_previsto`.
- `parcial`: `0 < valor_pago < valor_previsto`. O saldo restante vai para a próxima parcela ou vira uma parcela nova (escolha do usuário).
- **Atrasada** (calculada): `status = prevista` e `vencimento < hoje`.
- Contrato `quitado` quando todas as parcelas estão `paga`.

---

## 6) Integração com o que já existe

### 6.1 Lançamentos

| Ação | Efeito |
| --- | --- |
| Marcar parcela de **tomado** como paga | Cria `transactions` tipo **despesa** na conta escolhida, categoria "Empréstimos" |
| Marcar parcela de **concedido** como recebida | Cria `transactions` tipo **receita** na conta escolhida |
| Contratar **tomado** com "creditar na conta" | Cria receita de `valor_principal` na data da contratação |
| Contratar **concedido** com "debitar da conta" | Cria despesa de `valor_principal` na data da contratação |
| Reverter baixa | Remove a transação gerada e volta a parcela para `prevista` |

### 6.2 Notificações (reaproveitando `RegraNotificacao`)

Criar regras em `App\Notificacoes\Regras\`, registradas em `config('notificacoes.regras')`:

| Regra | Quando dispara | `dedupe_key` |
| --- | --- | --- |
| `EmprestimoVenceEmBreveRegra` | X dias antes do vencimento (padrão 2) | `emprestimo:{parcela}:breve:{vencimento}` |
| `EmprestimoVenceHojeRegra` | No dia do vencimento | `emprestimo:{parcela}:hoje:{vencimento}` |
| `EmprestimoAtrasadoRegra` | Vencido e não pago (1x por parcela, depois a cada N dias) | `emprestimo:{parcela}:atraso:{N}` |

Mensagens diferentes para cada direção:
- Tomado: "Você paga R$ 100 para Fulano hoje."
- Concedido: "Fulano deve R$ 100 hoje. Marcar como recebido?"

### 6.3 Dashboard e relatórios

- Card no dashboard: **Eu devo** (total em aberto) × **Me devem** (total em aberto) + próximos 3 vencimentos.
- Integrar as parcelas em **Compromissos futuros** (`GeradorEventosFinanceiros`) e na projeção do **Simulador financeiro**, que já existe.
- Relatório de **custo de juros** (quanto já paguei/recebi de juros no ano).

### 6.4 Automação (Fase 2)

Seguir o padrão de `QuitarFaturasAutomaticamente`, com opção por contrato `modo_baixa = automatica`. Regra de segurança: no lançamento automático de **despesa**, checar saldo da conta; se não houver saldo, a parcela fica `prevista` com aviso, em vez de baixar.

### 6.5 Conciliação bancária (Fase 3)

Quando um extrato OFX tiver valor e data compatíveis com uma parcela, sugerir o vínculo no fluxo de conciliação existente.

---

## 7) UX / UI

### 7.1 Princípios

1. **Linguagem de pessoa, não de sistema.** "Eu devo" e "Me devem", nunca "passivo" ou "ativo".
2. **Uma decisão por tela.** Criar contrato em 3 passos curtos; baixar parcela em um toque.
3. **Mostrar o resultado antes de salvar.** Cronograma e total de juros aparecem ao vivo enquanto o usuário digita.
4. **Status com texto, não só cor.** "Atrasada há 3 dias" além do vermelho.
5. **Presets com exemplo.** Cada modalidade explica o caso com números reais.

### 7.2 Navegação

Novo item no menu: **Empréstimos** (ícone de mãos/moedas), com rota `/emprestimos`, no padrão de `recorrencias`, `orcamentos` etc.

### 7.3 Tela principal — `/emprestimos`

```
┌──────────────────────────────────────────────────────────┐
│ Empréstimos                              [ + Novo ]      │
├──────────────────────────────────────────────────────────┤
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ │
│ │ Eu devo        │ │ Me devem       │ │ Próximo venc.  │ │
│ │ R$ 12.340      │ │ R$ 5.000       │ │ 26/11 · R$ 100 │ │
│ │ 2 contratos    │ │ 1 contrato     │ │ Fulano         │ │
│ └────────────────┘ └────────────────┘ └────────────────┘ │
│                                                          │
│  [ Todos ]  [ Eu devo ]  [ Me devem ]  [ Atrasados ⚠ ]  │
│                                                          │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ↓ Me devem · Fulano                       ativo      │ │
│ │ R$ 5.000 · 2% a.m. simples · juros periódicos       │ │
│ │ Próximo: 26/11 · R$ 100          [ Marcar recebido ]│ │
│ └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

Estado vazio: ilustração simples + frase "Registre um empréstimo que você fez ou recebeu" + botão.

### 7.4 Cadastro em 3 passos

**Passo 1 — Quem e quanto**
- Tipo: `Eu peguei emprestado` | `Eu emprestei` (cards grandes)
- Pessoa ou instituição, valor, data da contratação
- Toggle: "Creditar na conta" / "Debitar da conta" (conta padrão para baixas)

**Passo 2 — Como funciona**
Cards de modalidade com exemplo embutido:

```
( ) Só juros, principal no fim
    Ex.: 2% ao mês = R$ 100/mês e R$ 5.000 no fim.
( ) Parcelado (parcela fixa)         — Price
( ) Parcelado (amortização fixa)     — SAC
( ) Pagamento único                  — principal + juros em uma data
( ) Parcelas livres                  — eu digito cada valor
```

Taxa: campo + seletor `% ao mês | % ao ano | % ao dia` + seletor `Juros simples | Juros compostos`.

**Passo 3 — Vencimentos e revisão**
- Dia do vencimento (ex.: 26) + primeira data
- Número de parcelas **ou** "prazo em aberto"
- Carência (opcional)
- **Prévia do cronograma** ao vivo: tabela com parcelas, totais e "Total de juros: R$ X"

### 7.5 Detalhe do contrato — `/emprestimos/:id`

```
┌──────────────────────────────────────────────────────────┐
│ ← Empréstimos                                            │
│ Fulano · Me devem                              ativo    │
│ R$ 5.000 · 2% a.m. simples · juros periódicos            │
│                                                          │
│ Recebido 1 de 12   ████░░░░░░░░░░░░░░   R$ 100 de 1.200  │
│                                                          │
│ ┌ Próxima parcela ─────────────────────────────────────┐ │
│ │ Parcela 2 · vence 26/12/2026 · R$ 100                │ │
│ │ [ Marcar como recebida ]   [ Outra data ]   [ Não ]  │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ [ Parcelas ] [ Pagamentos ] [ Simular ] [ Ajustes ] [ Histórico ] │
└──────────────────────────────────────────────────────────┘
```

Ações principais:
- **Marcar como paga/recebida**: abre um sheet com valor (preenchido), data (hoje), conta (padrão do contrato). Confirmar cria o lançamento.
- **Não paga**: abre um sheet para registrar a ocorrência (motivo opcional), mantém a parcela atrasada e agenda o próximo aviso.
- **Pagamento parcial**: valor menor que o previsto; pergunta o que fazer com o restante.
- **Parcelas livres**: edição inline do valor de cada linha.

Abas:
- **Parcelas**: lista com status por texto e cor; filtro por status.
- **Pagamentos**: histórico de baixas com link para a transação.
- **Simular**: "E se eu antecipar R$ 1.000 agora?" — mostra economia de juros e nova data de término. Também compara Price × SAC × juros periódicos lado a lado para o mesmo valor.
- **Ajustes**: taxa de atraso, multa, modo de baixa, conta e categoria padrão, encerrar contrato.
- **Histórico**: eventos do contrato (eventos da seção 3.3).

### 7.6 Mobile

- Lista em cards de uma coluna.
- Sheets (bottom sheet) para baixa e ações.
- Abas viram um seletor horizontal rolável.
- Sem tabelas largas: o cronograma vira lista com "Parcela 2 · 26/12 · R$ 100 · prevista".

### 7.7 Feedback

- Toasts já existentes para confirmação ("Parcela 2 marcada como recebida").
- Sino de notificações já existente para vencimentos e atrasos.
- Confirmação explícita para ações que criam ou removem lançamentos ("Isso também remove a receita de R$ 100 da conta X").

---

## 8) Backend — arquivos previstos

```
backend/app/
  Enums/            DirecaoEmprestimo, ModalidadeEmprestimo, TipoJuros, PeriodoTaxa,
                    StatusEmprestimo, StatusParcelaEmprestimo, ModoBaixaEmprestimo
  Models/           Emprestimo, EmprestimoParcela, EmprestimoEvento
  Support/Emprestimos/
                    GeradorCronograma (puro), Juros (conversões e cálculos),
                    RegraVencimento, CalculadoraAtraso (Fase 2)
  Actions/Emprestimos/
                    CriarEmprestimo, BaixarParcela, ReverterBaixa,
                    AnteciparParcela (F2), AmortizacaoExtra (F2), Renegociar (F2)
  Http/Controllers/EmprestimoController.php
  Http/Requests/Emprestimos/
  Http/Resources/EmprestimoResource.php
  Notificacoes/Regras/Emprestimo*Regra.php
  Queries/Emprestimos/  ResumoEmprestimosQuery (dashboard)
database/migrations/  create_emprestimos, create_emprestimo_parcelas,
                      create_emprestimo_eventos, add_emprestimo_parcela_id_to_transactions
```

Rotas previstas (`routes/api.php`, mesmo estilo de `/recorrencias`):

```
GET    /emprestimos
POST   /emprestimos/criar
GET    /emprestimos/{emprestimo}
PUT    /emprestimos/atualizar/{emprestimo}
DELETE /emprestimos/deletar/{emprestimo}
POST   /emprestimos/previa                       (cronograma sem salvar — usado no passo 3)
POST   /emprestimos/{emprestimo}/parcelas/{parcela}/baixar
POST   /emprestimos/{emprestimo}/parcelas/{parcela}/reverter
POST   /emprestimos/{emprestimo}/parcelas/{parcela}/nao-paga
GET    /emprestimos/{emprestimo}/historico
POST   /emprestimos/{emprestimo}/simular         (F2)
POST   /emprestimos/{emprestimo}/antecipar      (F2)
GET    /emprestimos/resumo                       (dashboard)
```

---

## 9) Frontend — arquivos previstos

```
web/src/pages/Emprestimos/
  EmprestimosRoute.tsx
  ListagemEmprestimos.tsx
  CadastrarEmprestimo.tsx          (wizard de 3 passos)
  DetalheEmprestimo.tsx
  components/
    CardResumo.tsx
    CardModalidade.tsx
    PreviaCronograma.tsx           (compartilhado entre criar e simular)
    ProximaParcelaCard.tsx
    BaixaParcelaSheet.tsx
    ParcelasTabela.tsx
    SimuladorEmprestimo.tsx        (F2)
web/src/api/emprestimos.ts
web/src/schemas/emprestimo.ts
web/src/types/emprestimo.ts
```

Seguir os padrões de `Recorrencia` e `Orcamento` (rota, formulários, listagens).

---

## 10) Testes

- **Backend (PHPUnit, `php artisan test`)**
  - Unitários do motor: juros simples, composto, Price, SAC, bullet, pagamento único, conversões de taxa, base 30 e 365, ajuste de dia 30/31, arredondamento e soma das parcelas = total.
  - **Caso de referência**: 5.000 a 2% simples, juros periódicos, dia 26 a partir de 26/11/2026 → 12 parcelas de R$ 100 + principal de R$ 5.000 no último vencimento.
  - Feature: criar, baixar, reverter baixa (remove transação), parcela parcial, status atrasada, isolamento entre usuários.
  - Notificações: não duplica ao rodar o job duas vezes (mesmo padrão de `NotificacaoTest`).
- **Frontend (`npm test`)**: wizard (validação por passo), prévia atualiza ao mudar taxa/dia, baixa cria o lançamento esperado.

---

## 11) Fases

### Fase 1 — MVP (o que resolve o caso de referência)
- Cadastro nas duas direções, com wizard de 3 passos.
- Modalidades: juros periódicos, Price, SAC, pagamento único.
- Juros simples e compostos; taxa ao mês, ao ano e ao dia.
- Vencimento mensal com dia fixo e ajuste de fim de mês.
- Baixa manual (total e parcial), reversão e "não paga".
- Lançamento automático em `transactions` com vínculo.
- Notificações: vence em breve, vence hoje, atrasada.
- Lista, detalhe com parcelas, card no dashboard.

### Fase 2
- Antecipação com desconto de juros; amortização extra com recálculo.
- Carência; multa e juros de mora.
- Frequências quinzenal, semanal, anual e a cada N dias.
- Baixa automática por contrato (com checagem de saldo).
- Simulador comparativo (Price × SAC × juros periódicos).
- Renegociação com vínculo ao contrato original.
- Relatório de custo de juros.

### Fase 3
- Conciliação com extrato OFX.
- Dias úteis e calendário de feriados.
- Contratos de financiamento com taxa administrativa e seguro.
- Anexos (contrato em PDF).

---

## 12) Pendências e perguntas

Os padrões da seção 2 são o que eu vou usar se você não mudar nada. Confirme ou corrija:

1. O "2%" é **ao mês**? (assumi que sim)
2. Quando você **pega** dinheiro emprestado, o valor deve **entrar na conta** automaticamente? (padrão: sim, com opção de desligar)
3. Você quer **baixa automática** de parcelas desde a primeira versão, ou só manual no MVP? (padrão: manual)
4. Juros proporcionais por **30 dias** ou pelo **ano de 365 dias**? (padrão: 30)
5. Para empréstimos **sem prazo final**, quando encerrar: data informada por você ou fim do contrato por pagamento total?

Itens técnicos que ficam para a implementação:
- Confirmar a convenção de valor monetário usada em `transactions` (decimal ou centavos) antes de criar as colunas.
- Rodar análise de impacto (GitNexus) nos símbolos que forem alterados, como `Transacao`, `GerarNotificacoes` e `config/notificacoes.php`.
- Criar branch antes do primeiro commit (o projeto está na `main`): `feat/backend-emprestimos` e `feat/frontend-emprestimos`.
- Atualizar `docs/manual-usuario.md` com a seção de empréstimos ao final da Fase 1.
