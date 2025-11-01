# 📋 Componente Listagem

## Visão Geral

O componente `Listagem` é um **template reutilizável** para criar páginas de listagem de dados com filtros, ordenação e paginação de forma consistente em todo o sistema.

Ele utiliza o padrão **Compound Components**, onde cada parte da listagem é um sub-componente independente que você pode compor conforme necessário.

---

## 🎯 Quando Usar

Use o componente `Listagem` quando precisar:
- Exibir uma **tabela de dados** com paginação
- Permitir **filtros** e **ordenação**
- Ter **ações** como criar, exportar, etc
- Manter um **layout consistente** entre diferentes listagens

---

## 📦 Estrutura do Componente

### Hierarquia de Componentes

```
<Listagem>
  ├── <Listagem.Header>
  │   ├── <Listagem.Acoes>          // Botões à esquerda
  │   └── <Listagem.Controles>      // Controles à direita
  │       ├── <Listagem.LimiteSelector>
  │       ├── <Listagem.FiltrosDropdown>
  │       └── <Listagem.OrdenarDropdown>
  ├── <Listagem.Tabela>             // Tabela com dados
  └── <Listagem.Paginacao>          // Paginação
```

---

## 🧩 Componentes Disponíveis

### `<Listagem>`
Container principal da listagem.

**Props:** Nenhuma (recebe apenas `children`)

---

### `<Listagem.Header>`
Header que contém ações e controles.

**Props:** Nenhuma (recebe apenas `children`)

**Layout:** Flexbox com `justify-content-between` (esquerda/direita)

---

### `<Listagem.Acoes>`
Área para botões de ação no canto esquerdo.

**Props:** Nenhuma (recebe apenas `children`)

**Uso comum:**
- Botão "Criar novo"
- Botão "Exportar"
- Botões de ações em massa

---

### `<Listagem.Controles>`
Área para controles no canto direito (filtros, ordenação, limite).

**Props:** Nenhuma (recebe apenas `children`)

---

### `<Listagem.LimiteSelector>`
Select para escolher quantos itens exibir por página.

**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| `value` | `number` | Valor atual do limite |
| `onChange` | `(limit: number) => void` | Função chamada ao mudar o limite |
| `options` | `number[]` | Opções disponíveis (padrão: `[25, 50, 75, 100]`) |

**Exemplo:**
```tsx
<Listagem.LimiteSelector
  value={filtros.limit}
  onChange={(limit) => setFiltros(prev => ({ ...prev, limit }))}
/>
```

---

### `<Listagem.FiltrosDropdown>`
Dropdown para filtros customizáveis.

**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| `children` | `ReactNode` | Conteúdo dos filtros (selects, inputs, etc) |
| `onAplicar` | `() => void` | Função chamada ao clicar "Aplicar" |
| `onLimpar` | `() => void` | Função chamada ao clicar "Limpar" |

**Exemplo:**
```tsx
<Listagem.FiltrosDropdown
  onAplicar={() => setFiltros(filtrosModificados)}
  onLimpar={() => setFiltros(filtrosOriginais)}
>
  <div className="px-3 py-2">
    <label className="form-label small">Categoria:</label>
    <select className="form-select form-select-sm">
      <option value="">Todas</option>
      <option value="1">Categoria 1</option>
    </select>
  </div>
</Listagem.FiltrosDropdown>
```

**⚠️ Importante:** O conteúdo do dropdown **não precisa** do padding `px-3 py-2` em cada filho, mas é recomendado para espaçamento consistente.

---

### `<Listagem.OrdenarDropdown>`
Dropdown para opções de ordenação.

**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| `children` | `ReactNode` | Radios de ordenação |

**Exemplo:**
```tsx
<Listagem.OrdenarDropdown>
  <div className="form-check">
    <input
      type="radio"
      name="ordenar"
      className="form-check-input"
      id="date_desc"
      value="date_desc"
      checked={filtros.order_by === "date_desc"}
      onChange={(e) => setFiltros({ ...filtros, order_by: e.target.value })}
    />
    <label htmlFor="date_desc" className="form-check-label">
      Data decrescente
    </label>
  </div>
</Listagem.OrdenarDropdown>
```

**⚠️ Importante:** Os radios são automaticamente envolvidos em `<div className="px-3">` pelo componente.

---

### `<Listagem.Tabela>`
Tabela com loading state e mensagem de vazio.

**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| `headers` | `string[]` | Array com nomes das colunas |
| `children` | `ReactNode` | Linhas da tabela (`<tr>`) |
| `loading` | `boolean` | Se está carregando (mostra spinner) |
| `emptyMessage` | `string` | Mensagem quando não há dados (padrão: "Nenhum registro encontrado") |

**Exemplo:**
```tsx
<Listagem.Tabela
  headers={["ID", "Nome", "Email", "Ações"]}
  loading={isLoading}
  emptyMessage="Nenhum usuário encontrado"
>
  {usuarios.map((user) => (
    <tr key={user.id}>
      <td>{user.id}</td>
      <td>{user.name}</td>
      <td>{user.email}</td>
      <td>
        <button className="btn btn-sm btn-primary">Editar</button>
      </td>
    </tr>
  ))}
</Listagem.Tabela>
```

**⚠️ Comportamento:**
- Se `loading={true}` → Mostra spinner centralizado
- Se `loading={false}` e sem `children` → Mostra `emptyMessage`
- Se tem `children` → Renderiza as linhas normalmente

---

### `<Listagem.Paginacao>`
Container para o componente de paginação.

**Props:** Nenhuma (recebe apenas `children`)

**Exemplo:**
```tsx
<Listagem.Paginacao>
  <Paginator
    meta={data?.meta}
    onPageChange={(page) => setFiltros(prev => ({ ...prev, page }))}
    isLoading={isFetching}
  />
</Listagem.Paginacao>
```

---

## 📝 Template Completo

Use este template como ponto de partida para criar novas listagens:

```tsx
import { Listagem } from "../components/Listagens/Listagem";
import { Paginator } from "../components/Listagens/Paginator";
import PageLayout from "../layouts/PageLayout";

export default function MinhaListagem() {
  return (
    <PageLayout title="Título da Página">
      <Listagem>
        {/* ========== HEADER ========== */}
        <Listagem.Header>
          {/* BOTÕES À ESQUERDA */}
          <Listagem.Acoes>
            {/* AÇÕES AQUI (ex: botão criar, exportar, etc) */}
          </Listagem.Acoes>

          {/* CONTROLES À DIREITA */}
          <Listagem.Controles>
            {/* LIMITE DE ITENS POR PÁGINA */}
            <Listagem.LimiteSelector
              value={0} // VALOR DO LIMITE
              onChange={(qtd) => {}} // FUNÇÃO PARA MUDAR LIMITE
            />

            {/* DROPDOWN DE FILTROS */}
            <Listagem.FiltrosDropdown
              onAplicar={() => {}} // FUNÇÃO APLICAR FILTROS
              onLimpar={() => {}} // FUNÇÃO LIMPAR FILTROS
            >
              {/* FILTROS AQUI (selects, inputs, etc) */}
            </Listagem.FiltrosDropdown>

            {/* DROPDOWN DE ORDENAÇÃO */}
            <Listagem.OrdenarDropdown>
              {/* OPÇÕES DE ORDENAÇÃO AQUI (radios) */}
            </Listagem.OrdenarDropdown>
          </Listagem.Controles>
        </Listagem.Header>

        {/* ========== TABELA ========== */}
        <Listagem.Tabela
          headers={[]} // ARRAY COM NOMES DAS COLUNAS
          loading={false} // ESTADO DE LOADING
          emptyMessage="Nenhum registro encontrado" // MENSAGEM QUANDO VAZIO
        >
          {/* LINHAS DA TABELA AQUI (map dos dados) */}
        </Listagem.Tabela>

        {/* ========== PAGINAÇÃO ========== */}
        <Listagem.Paginacao>
          <Paginator
            meta={{}} // OBJETO META DA PAGINAÇÃO
            onPageChange={() => {}} // FUNÇÃO MUDAR PÁGINA
            isLoading={false} // ESTADO DE LOADING DA PAGINAÇÃO
          />
        </Listagem.Paginacao>
      </Listagem>
    </PageLayout>
  );
}
```

---

## 💡 Exemplo Prático: Listagem de Despesas

```tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Listagem } from "../components/Listagens/Listagem";
import { Paginator } from "../components/Listagens/Paginator";
import PageLayout from "../layouts/PageLayout";
import { getDespesas } from "../api/transacoes";
import { Link } from "react-router-dom";

const filtrosOriginais = {
  page: 1,
  limit: 25,
  categoria_id: undefined,
  order_by: "date_desc",
};

export default function ListagemDespesas() {
  const [filtros, setFiltros] = useState(filtrosOriginais);
  const [filtrosModificados, setFiltrosModificados] = useState(filtrosOriginais);

  const { data, isLoading } = useQuery({
    queryKey: ["despesas", filtros],
    queryFn: () => getDespesas(filtros),
  });

  const despesas = data?.data || [];

  return (
    <PageLayout title="Despesas">
      <Listagem>
        <Listagem.Header>
          <Listagem.Acoes>
            <Link to="/despesas/criar" className="btn btn-success">
              <i className="bi bi-plus-circle me-2"></i>
              Nova Despesa
            </Link>
          </Listagem.Acoes>

          <Listagem.Controles>
            <Listagem.LimiteSelector
              value={filtros.limit}
              onChange={(limit) => setFiltros(prev => ({ ...prev, limit }))}
            />

            <Listagem.FiltrosDropdown
              onAplicar={() => setFiltros({ ...filtrosModificados, page: 1 })}
              onLimpar={() => {
                setFiltros(filtrosOriginais);
                setFiltrosModificados(filtrosOriginais);
              }}
            >
              <div className="px-3 py-2">
                <label className="form-label small">Categoria:</label>
                <select
                  value={filtrosModificados.categoria_id || ""}
                  onChange={(e) =>
                    setFiltrosModificados({
                      ...filtrosModificados,
                      categoria_id: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  className="form-select form-select-sm"
                >
                  <option value="">Todas</option>
                  <option value="1">Alimentação</option>
                  <option value="2">Transporte</option>
                </select>
              </div>
            </Listagem.FiltrosDropdown>

            <Listagem.OrdenarDropdown>
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                  id="date_desc"
                  value="date_desc"
                  checked={filtros.order_by === "date_desc"}
                  onChange={(e) => setFiltros({ ...filtros, order_by: e.target.value })}
                />
                <label htmlFor="date_desc" className="form-check-label">
                  Mais recentes
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                  id="date_asc"
                  value="date_asc"
                  checked={filtros.order_by === "date_asc"}
                  onChange={(e) => setFiltros({ ...filtros, order_by: e.target.value })}
                />
                <label htmlFor="date_asc" className="form-check-label">
                  Mais antigas
                </label>
              </div>
            </Listagem.OrdenarDropdown>
          </Listagem.Controles>
        </Listagem.Header>

        <Listagem.Tabela
          headers={["ID", "Descrição", "Valor", "Data", "Categoria", "Ações"]}
          loading={isLoading}
          emptyMessage="Nenhuma despesa encontrada"
        >
          {despesas.map((despesa) => (
            <tr key={despesa.id}>
              <td>{despesa.id}</td>
              <td>{despesa.description}</td>
              <td className="text-danger fw-bold">R$ {despesa.amount}</td>
              <td>{despesa.date}</td>
              <td>
                <span className="badge bg-secondary">{despesa.categoria?.name || "-"}</span>
              </td>
              <td>
                <Link to={`/despesas/editar/${despesa.id}`} className="btn btn-sm btn-primary">
                  <i className="bi bi-pencil"></i>
                </Link>
              </td>
            </tr>
          ))}
        </Listagem.Tabela>

        <Listagem.Paginacao>
          <Paginator
            meta={data?.meta}
            onPageChange={(page) => setFiltros(prev => ({ ...prev, page }))}
            isLoading={isLoading}
          />
        </Listagem.Paginacao>
      </Listagem>
    </PageLayout>
  );
}
```

---

## ✅ Boas Práticas

### 1. **Separação de Filtros**
Use dois estados: um para filtros aplicados e outro para filtros sendo editados.

```tsx
const [filtros, setFiltros] = useState(filtrosOriginais); // Aplicados
const [filtrosModificados, setFiltrosModificados] = useState(filtrosOriginais); // Sendo editados
```

### 2. **Resetar Página ao Filtrar**
Sempre volte para a página 1 ao aplicar novos filtros.

```tsx
<Listagem.FiltrosDropdown
  onAplicar={() => setFiltros({ ...filtrosModificados, page: 1 })} // ✅
  onLimpar={() => setFiltros(filtrosOriginais)}
>
```

### 3. **Loading States**
Use `isLoading` para o loading inicial e `isFetching` para refetch.

```tsx
const { data, isLoading, isFetching } = useQuery(...);

<Listagem.Tabela loading={isLoading} /> // Só primeira carga
<Paginator isLoading={isFetching} /> // Qualquer refetch
```

### 4. **Campos Controlados**
Sempre use `value` nos inputs/selects de filtro para funcionar o "Limpar".

```tsx
<select
  value={filtrosModificados.categoria_id || ""} // ✅ Controlado
  onChange={(e) => setFiltrosModificados({ ...filtrosModificados, categoria_id: e.target.value })}
>
```

### 5. **Tipagem dos Filtros**
Defina um tipo para seus filtros para ter autocomplete.

```tsx
type FiltrosDespesa = {
  page: number;
  limit: number;
  categoria_id?: number;
  order_by: string;
};

const filtrosOriginais: FiltrosDespesa = { ... };
```

---

## ⚠️ Erros Comuns

### ❌ Não usar campos controlados
```tsx
// ❌ ERRADO
<select onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}>
```
**Problema:** O campo não limpa ao clicar "Limpar"

**✅ CORRETO:**
```tsx
<select
  value={filtros.categoria || ""}
  onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
>
```

### ❌ Não resetar página ao filtrar
```tsx
// ❌ ERRADO
onAplicar={() => setFiltros(filtrosModificados)}
```
**Problema:** Pode ficar em uma página que não existe após filtrar

**✅ CORRETO:**
```tsx
onAplicar={() => setFiltros({ ...filtrosModificados, page: 1 })}
```

### ❌ Usar `loading` para refetch
```tsx
// ❌ ERRADO
<Listagem.Tabela loading={isFetching} />
```
**Problema:** Mostra loading toda vez que refaz query (péssimo UX)

**✅ CORRETO:**
```tsx
<Listagem.Tabela loading={isLoading} /> // Só primeira carga
```

---

## 🔧 Customização

### Adicionar Novo Componente

Se precisar de um novo sub-componente, adicione em `Listagem.tsx`:

```tsx
// Listagem.tsx
interface BuscaProps {
  value: string;
  onChange: (value: string) => void;
}

Listagem.Busca = function Busca({ value, onChange }: BuscaProps) {
  return (
    <div className="input-group" style={{ width: "250px" }}>
      <span className="input-group-text">
        <i className="bi bi-search"></i>
      </span>
      <input
        type="text"
        className="form-control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar..."
      />
    </div>
  );
};
```

**Uso:**
```tsx
<Listagem.Controles>
  <Listagem.Busca value={busca} onChange={setBusca} />
</Listagem.Controles>
```

---

## 📚 Referências

- [React Compound Components Pattern](https://kentcdodds.com/blog/compound-components-with-react-hooks)
- [Bootstrap 5 Dropdowns](https://getbootstrap.com/docs/5.3/components/dropdowns/)
- [TanStack Query](https://tanstack.com/query/latest)

