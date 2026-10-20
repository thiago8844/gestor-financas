# Toasts e alertas

Feedback de operações no frontend. Tudo é local (zustand + React): nada é gravado no backend.

| | Quando usar |
|---|---|
| **Toast** | Resultado de uma operação (salvou, falhou, carregando), temporário ou persistente. |
| **Alerta inline** (`<Alerta />`) | Problema/aviso ligado a uma página, formulário ou seção (falha ao carregar, alterações não salvas, estado da fatura). Não some sozinho e não entra na fila. |
| **Erro de validação** | Fica junto do campo (`FieldError`), nunca só em toast. |
| **Central de notificações** | Histórico vindo do servidor (módulo `Notificacoes`). Toast não vira notificação. |

> Nunca afirme sucesso de operação financeira antes da confirmação real do servidor. Use `toast.promise` ou chame `toast.success` no `onSuccess`.

## Arquivos

- `src/stores/toast.ts`: estado, fila, deduplicação, atualização por ID e padrões por tipo.
- `src/utils/toast.ts`: API pública (`toast`).
- `src/utils/countdown.ts`: contagem regressiva com pausa/retomada (sem React).
- `src/components/Toast/ToastViewport.tsx`: montado uma vez em `layouts/GlobalComponents.tsx` (dentro do `DefaultLayout`).
- `src/components/Toast/ToastCard.tsx`: card, timers, pausas, ações, redução visual.
- `src/components/Toast/toastVisual.ts`: ícone/cor por tipo (compartilhado com o alerta inline).
- `src/components/Alerta.tsx`: alerta inline.
- `src/styles/components/toast.scss`: estilos (variáveis do Bootstrap, então acompanha tema claro/escuro).
- `src/pages/Dev/ToastsDemo.tsx`: demonstração (`/dev/toasts`, só em desenvolvimento).
- Testes: `src/utils/countdown.test.ts`, `src/stores/toast.test.ts`, `src/utils/toast.test.ts`, `src/stores/authToastIsolation.test.ts`.

## API

```ts
import { toast } from "../utils/toast";

toast.success("Conta atualizada", { message: "As alterações foram salvas." });
toast.error("Erro ao excluir conta", { message: "Tente novamente." });
toast.warning | toast.info | toast.neutral | toast.loading   // mesma assinatura

const id = toast.loading("Salvando transação...");            // devolve o ID (ou null se descartado)
toast.update(id, { kind: "success", title: "Transação salva" });
toast.dismiss(id);
toast.dismissAll();                                           // só os temporários
toast.dismissAll({ includePersistent: true });

// Carregando -> sucesso/erro no MESMO card, ligado a uma Promise:
toast.promise(api.post(...), {
  loading: "Salvando transação...",
  success: (r) => ({ title: "Transação salva", message: r.data.message }),
  error: (e) => ({ title: "Não foi possível salvar" }),       // opcional: padrão usa a mensagem da API
});
```

Opções (`ToastOptions`): `id`, `title`, `message`, `dismiss` (`"auto"|"manual"`), `duration` (ms), `fadeWhenIdle`,
`action` (`{ label, onClick?, to?, closeOnClick? }`), `dedupeKey`, `onClose(reason)` com
`reason` = `manual | timeout | action | programmatic`.

Ação: `onClick` pode ser assíncrono (botão bloqueado + spinner; falha mostra "Não foi possível concluir a ação" e mantém o toast).
Executar a ação **não** fecha o toast, a menos que `closeOnClick: true`. Fechar um toast de carregamento não cancela a operação.
Só ofereça "Desfazer" quando existir reversão real e segura.

Alerta inline:

```tsx
<Alerta tipo="error" titulo="Falha ao carregar transações" descricao="..." acao={{ rotulo: "Tentar novamente", onClick: refetch }} />
```

Props: `tipo`, `titulo`, `descricao`, `orientacoes[]`, `acao`, `onFechar`. Fechar só esconde; não resolve o problema.

## Padrões por tipo

| Tipo | Padrão |
|---|---|
| success / info / neutral | automático, 5 s |
| warning | automático, 8 s (use `dismiss: "manual"` quando exigir ação) |
| error | persistente |
| loading | persistente até `update`/`dismiss` |

## Estados, fila e empilhamento

Estados internos: `queued` → `visible` → `leaving` → removido (`finalizeRemoval`).

- Desktop: canto superior direito, ~380 px, margem 24 px. Mobile (< 576 px): topo, largura quase total, margem 12 px, respeitando áreas seguras.
- Máximo visível: 3 (desktop) / 2 (mobile), reduzido automaticamente se a altura da janela não comportar.
- Ordem de criação (antigos acima). Excedentes ficam em fila **FIFO** e **não são renderizados** (logo, não são anunciados antes de aparecer).
- A vaga só é liberada quando a animação de saída termina. Persistentes nunca são removidos para abrir espaço.
- **Limite da fila: 20.** Ao estourar, descarta-se o toast automático mais antigo da fila; se só houver persistentes na fila, o novo é descartado (`show` devolve `null`).
- O container não bloqueia cliques (`pointer-events: none`; só os cards recebem).
- Mensagens longas têm altura máxima e rolam dentro do card.

## Temporizador

- Começa quando o toast **aparece** (não enquanto está na fila).
- Pausa com hover, foco de teclado, aba oculta e ação em andamento; retoma do **tempo restante** (não reinicia).
- `update` só de texto não reinicia o prazo. Troca de `kind` (ex.: loading → success) aplica o modo do novo tipo e **recomeça** o prazo. Mudar `dismiss`/`duration` também recomeça.
- Persistente com `fadeWhenIdle`: após 5 s sem hover/foco fica visualmente discreto (menos sombra e borda; texto e fundo intactos). Volta ao normal com hover/foco e recomeça a contagem. Só em dispositivos com hover.

## Deduplicação

`dedupeKey` igual a um toast ainda na fila/visível atualiza esse toast em vez de empilhar outro (usado, por exemplo, para falhas de conexão repetidas). Repetir o mesmo conteúdo não reinicia o prazo.

## Resultado desconhecido

`toast.promise` trata falha **sem resposta do servidor** (timeout/rede) como aviso "Resultado não confirmado", não como erro: o timeout da interface não prova que a operação falhou.

## Sessão

`logout` (inclusive o disparado por 401) e troca de usuário em `fetchUser` chamam `clear()`: descartam toasts visíveis e a fila, sem executar callbacks.

## Acessibilidade

- Botão X: "Fechar aviso". Tudo operável por teclado; foco visível; área de toque 36 px.
- Não rouba foco. `role="alert"` para erro, `role="status"` para os demais; mudanças de contagem/animação não geram anúncio.
- Respeita `prefers-reduced-motion` (sem animações; saída imediata). Sem sons.
- Texto sempre renderizado como texto (sem HTML vindo da API). Não exiba stack trace, SQL ou tokens em mensagens.

## Demonstração e testes

- `npm run dev` e abrir `/dev/toasts` (logado). Cobre tipos, durações, persistentes, pausa, pilha/fila, mensagem longa, ações, loading → sucesso/erro/desconhecido, deduplicação e alertas inline. Para mobile/movimento reduzido use o modo dispositivo e a emulação de `prefers-reduced-motion` do DevTools.
- `npm test` (vitest): timers e retomada, fila FIFO, deduplicação, atualização por ID, limpeza de timers, isolamento após logout/troca de usuário e `toast.promise`.

## Limitações

- Os componentes React (ToastCard/Viewport) não têm teste automatizado; o comportamento de pausa por hover/foco/aba e a redução visual foram implementados mas só verificáveis manualmente na demo.
- A altura mínima por toast usada para reduzir a quantidade visível (110 px) é uma estimativa.
- Contrato para um app nativo futuro: mesmos tipos, padrões de tempo, limites (3/2 visíveis, fila FIFO de 20) e regras de pausa/deduplicação descritas aqui; nada foi implementado para outra plataforma.
- Os `confirm()` do navegador continuam em uso (fora do escopo; não foi criado sistema de modais de confirmação).
