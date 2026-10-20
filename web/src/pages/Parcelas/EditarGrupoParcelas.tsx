import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import PageLayout from "../../layouts/PageLayout";
import InputMoeda from "../../components/InputMoeda";
import { CategoriaAutocomplete } from "../Contas/components/CategoriaAutocomplete";
import { SeletorModoCentavos } from "../../components/Parcelamento/SeletorModoCentavos";
import { IndicadorSomaParcelas } from "../../components/Parcelamento/IndicadorSomaParcelas";
import { atualizarGrupoParcelas, excluirGrupoParcelas, getGrupoParcelas } from "../../api/transacoes";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask, mensagemErroApi } from "../../utils";
import { diferencaEntreSomaETotal, dividirEmCentavos, type ModoCentavos } from "../../utils/parcelas";
import type { AtualizarGrupoParcelasPayload, GrupoParcelasDetalhe } from "../../types/transacao";
import { toast } from "../../utils/toast";

type Linha = {
  id: number;
  numero: number;
  amount: string;
  /** Conta: vencimento (YYYY-MM-DD). Cartão: mês da fatura (YYYY-MM). */
  destino: string;
  destinoOriginal: string;
  amountOriginal: number;
  travada: boolean;
  status: "PENDING" | "PAID";
};

function montarLinhas(grupo: GrupoParcelasDetalhe): Linha[] {
  return grupo.parcelas.map((p) => {
    const destino =
      grupo.tipo === "cartao"
        ? (p.fatura?.reference_month ?? "").slice(0, 7)
        : (p.due_date_raw ?? "").slice(0, 10);

    return {
      id: p.id,
      numero: p.installment_number ?? 0,
      amount: convertNumberToCurrencyMask(Number(p.amount ?? 0)),
      destino,
      destinoOriginal: destino,
      amountOriginal: Number(p.amount ?? 0),
      travada: p.travada,
      status: p.status,
    };
  });
}

export function EditarGrupoParcelas() {
  const { grupo = "" } = useParams<{ grupo: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["grupo-parcelas", grupo],
    queryFn: () => getGrupoParcelas(grupo),
    enabled: !!grupo,
  });

  const [descricao, setDescricao] = useState("");
  const [categoriaNome, setCategoriaNome] = useState("");
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [totalMascara, setTotalMascara] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [modo, setModo] = useState<ModoCentavos>("ultima");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDescricao(data.description);
    setCategoriaNome(data.parcelas[0]?.categoria?.name ?? "");
    setCategoriaId(data.category_id);
    setTotalMascara(convertNumberToCurrencyMask(data.total));
    setLinhas(montarLinhas(data));
  }, [data]);

  const isCartao = data?.tipo === "cartao";
  const basePath = data?.type === "INCOME" ? "/receitas" : "/despesas";
  const total = convertCurrencyMaskToNumber(totalMascara) ?? 0;

  const valores = useMemo(() => linhas.map((l) => convertCurrencyMaskToNumber(l.amount) ?? 0), [linhas]);
  const diferenca = diferencaEntreSomaETotal(valores, total);
  const confere = Math.abs(diferenca) < 0.005;

  const atualizarLinha = (id: number, dados: Partial<Linha>) =>
    setLinhas((prev) => prev.map((l) => (l.id === id ? { ...l, ...dados } : l)));

  /** Reparte o total (menos o que já está travado) entre as parcelas ainda editáveis, no modo escolhido. */
  const redistribuir = () => {
    const livres = linhas.filter((l) => !l.travada);
    if (livres.length === 0) return;

    const travado = linhas.filter((l) => l.travada).reduce((acc, l) => acc + Math.round(l.amountOriginal * 100), 0);
    const restante = (Math.round(total * 100) - travado) / 100;

    if (restante <= 0) {
      setErro("O total é menor que o que já foi pago; ajuste o valor total antes de redistribuir.");
      return;
    }

    setErro(null);
    const partes = dividirEmCentavos(restante, livres.length, modo);
    const porId = new Map(livres.map((l, i) => [l.id, partes[i]]));

    setLinhas((prev) =>
      prev.map((l) => (porId.has(l.id) ? { ...l, amount: convertNumberToCurrencyMask((porId.get(l.id) ?? 0) / 100) } : l))
    );
  };

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ["grupo-parcelas"] });
    queryClient.invalidateQueries({ queryKey: ["despesas"] });
    queryClient.invalidateQueries({ queryKey: ["despesa"] });
    queryClient.invalidateQueries({ queryKey: ["receitas"] });
    queryClient.invalidateQueries({ queryKey: ["receita"] });
    queryClient.invalidateQueries({ queryKey: ["cartao"] });
    queryClient.invalidateQueries({ queryKey: ["cartoes"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-fatura-atual"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-indicadores"] });
  };

  const salvar = useMutation({
    mutationFn: (payload: AtualizarGrupoParcelasPayload) => atualizarGrupoParcelas(grupo, payload),
    onSuccess: () => {
      invalidar();
      toast.success("Parcelas atualizadas com sucesso!");
      navigate(basePath);
    },
    onError: (e) => setErro(mensagemErroApi(e, "Não foi possível salvar as parcelas.")),
  });

  const excluir = useMutation({
    mutationFn: () => excluirGrupoParcelas(grupo),
    onSuccess: () => {
      invalidar();
      toast.success("Grupo de parcelas excluído.");
      navigate(basePath);
    },
    onError: (e) => setErro(mensagemErroApi(e, "Não foi possível excluir o grupo.")),
  });

  const handleSalvar = () => {
    if (!data) return;

    if (!descricao.trim()) {
      setErro("A descrição é obrigatória.");
      return;
    }

    if (!confere) {
      setErro("A soma das parcelas precisa ser igual ao valor total da compra.");
      return;
    }

    if (valores.some((v) => v < 0.01)) {
      setErro("Cada parcela deve ter pelo menos R$ 0,01.");
      return;
    }

    const parcelas: NonNullable<AtualizarGrupoParcelasPayload["parcelas"]> = [];

    linhas.forEach((l, i) => {
      if (l.travada) return;

      const item: NonNullable<AtualizarGrupoParcelasPayload["parcelas"]>[number] = { id: l.id };
      const valorMudou = Math.round(valores[i] * 100) !== Math.round(l.amountOriginal * 100);
      const destinoMudou = l.destino !== "" && l.destino !== l.destinoOriginal;

      if (valorMudou) item.amount = valores[i];
      if (destinoMudou) {
        if (isCartao) item.invoice_month = `${l.destino}-01`;
        else item.due_date = l.destino;
      }

      if (valorMudou || destinoMudou) parcelas.push(item);
    });

    setErro(null);
    salvar.mutate({
      description: descricao.trim(),
      ...(categoriaId ? { category_id: categoriaId } : categoriaNome ? { category_name: categoriaNome } : {}),
      ...(parcelas.length > 0 ? { parcelas } : {}),
    });
  };

  const handleExcluir = () => {
    if (!confirm("Excluir TODAS as parcelas desta compra? Essa ação não pode ser desfeita.")) return;
    excluir.mutate();
  };

  if (isError) {
    return (
      <PageLayout title="Editar parcelas" backTo="/despesas">
        <div className="alert alert-danger">Não foi possível carregar o grupo de parcelas.</div>
      </PageLayout>
    );
  }

  const ocupado = salvar.isPending || excluir.isPending;

  return (
    <PageLayout loading={isLoading} title="Editar todas as parcelas" backTo={basePath}>
      <div className="container mt-4">
        {erro && <div className="alert alert-danger">{erro}</div>}

        <div className="row">
          <div className="col-lg-6 mb-3">
            <label className="form-label">Descrição</label>
            <input
              type="text"
              className="form-control"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
          <div className="col-lg-6 mb-3">
            <label className="form-label">Categoria</label>
            <CategoriaAutocomplete
              value={categoriaNome}
              onChange={(nome, id) => {
                setCategoriaNome(nome);
                setCategoriaId(id ?? null);
              }}
            />
          </div>
        </div>

        <div className="border rounded p-3 mb-3">
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label">Valor total da compra</label>
              <InputMoeda
                value={totalMascara}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotalMascara(e.target.value)}
              />
              <div className="form-text">A soma das parcelas sempre precisa fechar com este valor.</div>
            </div>
            <div className="col-md-5">
              <SeletorModoCentavos valor={modo} onChange={setModo} />
            </div>
            <div className="col-md-3">
              <button type="button" className="btn btn-outline-primary w-100" onClick={redistribuir}>
                Redistribuir pendentes
              </button>
            </div>
          </div>

          <hr />

          <div className="table-responsive">
            <table className="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Parcela</th>
                  <th style={{ minWidth: 140 }}>Valor</th>
                  <th>{isCartao ? "Fatura (mês do vencimento)" : "Vencimento"}</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.numero}/{data?.parcelas.length}
                    </td>
                    <td>
                      <InputMoeda
                        value={l.amount}
                        disabled={l.travada}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          atualizarLinha(l.id, { amount: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        type={isCartao ? "month" : "date"}
                        className="form-control form-control-sm"
                        disabled={l.travada}
                        value={l.destino}
                        onChange={(e) => atualizarLinha(l.id, { destino: e.target.value })}
                      />
                    </td>
                    <td>
                      {l.travada ? (
                        <span className="badge text-bg-secondary">
                          <i className="bi bi-lock me-1"></i>
                          {l.status === "PAID" ? "Paga" : "Conciliada"}
                        </span>
                      ) : (
                        <span className="badge text-bg-warning">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <IndicadorSomaParcelas diferenca={diferenca} />
        </div>

        <div className="d-flex gap-2 justify-content-between">
          <button type="button" className="btn btn-outline-danger" onClick={handleExcluir} disabled={ocupado}>
            <i className="bi bi-trash me-2"></i>
            Excluir grupo inteiro
          </button>

          <div className="d-flex gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(basePath)} disabled={ocupado}>
              Cancelar
            </button>
            <button type="button" className="btn btn-success" onClick={handleSalvar} disabled={ocupado || !data}>
              {salvar.isPending ? "Salvando..." : "Salvar parcelas"}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
