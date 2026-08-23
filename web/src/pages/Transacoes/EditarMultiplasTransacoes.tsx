import { useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import { useFormularioTransacao } from "../../hooks/useFormularioDespesa";
import {
  DespesaEditavelCard,
  type TransacaoEditavelCardHandle,
} from "../Despesa/DespesaEditavelCard";
import { ReceitaEditavelCard } from "../Receita/ReceitaEditavelCard";

type Props = {
  tipo: "EXPENSE" | "INCOME";
  backTo: string;
  titulo: string;
};

export function EditarMultiplasTransacoes({ tipo, backTo, titulo }: Props) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { contas, isLoading, isError } = useFormularioTransacao();

  const ids = useMemo(() => {
    const raw = searchParams.get("ids") || "";
    return raw
      .split(",")
      .map((id) => Number(id))
      .filter((id) => !Number.isNaN(id) && id > 0);
  }, [searchParams]);

  const refs = useRef<Record<number, TransacaoEditavelCardHandle | null>>({});
  const [salvandoTodas, setSalvandoTodas] = useState(false);
  const [resumo, setResumo] = useState<{ sucesso: number; falha: number } | null>(null);

  const salvarTodas = async () => {
    setSalvandoTodas(true);
    setResumo(null);

    const resultados = await Promise.allSettled(
      ids.map((id) => refs.current[id]?.submeter() ?? Promise.resolve())
    );

    const sucesso = resultados.filter((resultado) => resultado.status === "fulfilled").length;
    const falha = resultados.length - sucesso;

    setResumo({ sucesso, falha });
    setSalvandoTodas(false);

    if (falha === 0) {
      alert(`${sucesso} transação(ões) salva(s) com sucesso!`);
      navigate(backTo);
    }
  };

  if (isError) {
    return (
      <PageLayout title={titulo} backTo={backTo}>
        <div className="alert alert-danger">Erro ao carregar dados necessários.</div>
      </PageLayout>
    );
  }

  if (ids.length === 0) {
    return (
      <PageLayout title={titulo} backTo={backTo}>
        <div className="alert alert-warning">Nenhuma transação selecionada.</div>
      </PageLayout>
    );
  }

  return (
    <PageLayout loading={isLoading} title={titulo} backTo={backTo}>
      <div className="container-fluid">
        <div className="container mt-4">
          <p className="text-muted">
            Editando {ids.length} transaç{ids.length !== 1 ? "ões" : "ão"}. Salve cada uma
            individualmente ou todas de uma vez no botão abaixo.
          </p>

          {resumo && resumo.falha > 0 && (
            <div className="alert alert-warning">
              {resumo.sucesso} salva{resumo.sucesso !== 1 ? "s" : ""}, {resumo.falha} com erro —
              corrija o(s) card(s) destacado(s) e tente novamente.
            </div>
          )}

          {ids.map((id) =>
            tipo === "EXPENSE" ? (
              <DespesaEditavelCard
                key={id}
                id={id}
                contas={contas}
                ref={(instancia) => {
                  refs.current[id] = instancia;
                }}
              />
            ) : (
              <ReceitaEditavelCard
                key={id}
                id={id}
                contas={contas}
                ref={(instancia) => {
                  refs.current[id] = instancia;
                }}
              />
            )
          )}

          <div className="d-flex gap-2 justify-content-end mt-4 mb-5">
            <button
              type="button"
              className="btn btn-secondary text-white"
              onClick={() => navigate(backTo)}
              disabled={salvandoTodas}
            >
              <i className="bi bi-x-circle me-2"></i>
              Cancelar
            </button>
            <button
              type="button"
              className="btn btn-success"
              onClick={salvarTodas}
              disabled={salvandoTodas}
            >
              {salvandoTodas ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Salvando todas...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle me-2"></i>
                  Salvar todas
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
