import { useQuery } from "@tanstack/react-query";
import { getLancamentosEmprestimo } from "../../../api/emprestimos";
import { ROTULO_LANCAMENTO, formatarDataBr, formatarMoeda } from "../../../utils/emprestimo";

/** O que este empréstimo lançou nas contas: valor emprestado, pagamentos de parcelas e ajustes. */
export function LancamentosEmprestimo({ emprestimoId }: { emprestimoId: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["emprestimo", emprestimoId, "lancamentos"],
    queryFn: () => getLancamentosEmprestimo(emprestimoId),
  });

  if (isLoading) return <p className="text-muted">Carregando...</p>;
  if (isError) return <div className="alert alert-danger">Não foi possível carregar os lançamentos.</div>;
  if (!data?.length) {
    return (
      <p className="text-muted">
        Este empréstimo ainda não lançou nada nas suas contas. Os lançamentos aparecem aqui quando você marca uma parcela como paga ou recebida, ou registra uma amortização.
      </p>
    );
  }

  return (
    <>
      <p className="text-muted small">Tudo o que este empréstimo lançou nas suas contas e que afeta o saldo delas.</p>
      <div className="table-responsive">
        <table className="table align-middle">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Origem</th>
              <th>Conta</th>
              <th className="text-end">Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.map((l) => (
              <tr key={l.id}>
                <td className="text-nowrap">{formatarDataBr(l.date)}</td>
                <td>{l.description ?? "-"}</td>
                <td><span className="badge text-bg-light border">{ROTULO_LANCAMENTO[l.kind]}</span></td>
                <td>{l.account?.name ?? "-"}</td>
                <td className={`text-end text-nowrap fw-semibold ${l.type === "INCOME" ? "text-success" : "text-danger"}`}>
                  {l.type === "INCOME" ? "+" : "-"} {formatarMoeda(l.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
