import { Listagem } from "../components/Listagens/Listagem";
import { Paginator } from "../components/Listagens/Paginator";
import PageLayout from "../layouts/PageLayout";

export default function TesteTabela() {
  const meta = {
    current_page: 1,
    from: 1,
    last_page: 1,
    links: [
      {
        url: null,
        label: "&laquo; Anterior",
        page: null,
        active: false,
      },
      {
        url: "http://localhost:8002/api/despesas?page=1",
        label: "1",
        page: 1,
        active: true,
      },
      {
        url: null,
        label: "Pr\u00f3xima &raquo;",
        page: null,
        active: false,
      },
    ],
    path: "http://localhost:8002/api/despesas",
    per_page: 25,
    to: 6,
    total: 6,
  };

  let qtdPorPagina = 15;

  return (
    <PageLayout title="Teste Tabela">
      <Listagem>
        {/* -=-=-=- HEADER -=-=-=- */}
        <Listagem.Header>
          <Listagem.Acoes>
            <button className="btn btn-primary">Testando</button>
          </Listagem.Acoes>

          <Listagem.Controles>
            <Listagem.LimiteSelector
              value={qtdPorPagina}
              onChange={(qtd) => (qtdPorPagina = qtd)}
            />

            <Listagem.FiltrosDropdown
              onAplicar={() => console.log("aplicar filtros")}
              onLimpar={() => console.log("limpar filtros")}
            >
              <select name="" id="" className="form-select form-select-sm">
                <option value="">Filtro 1</option>
                <option value="">Filtro 2</option>
              </select>
            </Listagem.FiltrosDropdown>

            <Listagem.OrdenarDropdown>
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                />
                <label htmlFor="date_desc" className="form-check-label">
                  Ordem 1
                </label>
              </div>
              <div className="form-check">
                <input
                  type="radio"
                  name="ordenar"
                  className="form-check-input"
                />
                <label htmlFor="date_desc" className="form-check-label">
                  Ordem 2
                </label>
              </div>
            </Listagem.OrdenarDropdown>
          </Listagem.Controles>
        </Listagem.Header>

        {/* -=-=-=- TABELA -=-=-=- */}
        <Listagem.Tabela
          headers={["HEADER 1", "HEADER 2", "HEADER 3"]}
          loading={false}
          emptyMessage="Mensagem de nada Encontrado"
        >
          <tr>
            <td>DADO 1</td>
            <td>DADO 2</td>
            <td>DADO 3</td>
          </tr>
          <tr>
            <td>DADO 1</td>
            <td>DADO 2</td>
            <td>DADO 3</td>
          </tr>
          <tr>
            <td>DADO 1</td>
            <td>DADO 2</td>
            <td>DADO 3</td>
          </tr>
          <tr>
            <td>DADO 1</td>
            <td>DADO 2</td>
            <td>DADO 3</td>
          </tr>
        </Listagem.Tabela>

        <Listagem.Paginacao>
          <Paginator
            meta={meta}
            onPageChange={() => console.log("mudar Pagina")}
            isLoading={false}
          />
        </Listagem.Paginacao>
      </Listagem>
    </PageLayout>
  );
}



////////