import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { AxiosError } from "axios";
import PageLayout from "../../layouts/PageLayout";
import { useFormularioTransacao } from "../../hooks/useFormularioDespesa";
import { importarOfx } from "../../api/ofxImportacoes";
import type { OfxArquivoDuplicadoError, OfxNecessitaContaError } from "../../types/ofx";
import type { Conta } from "../../types";

export function UploadOfx() {
  const navigate = useNavigate();
  const { contas, isLoading } = useFormularioTransacao();

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [contaId, setContaId] = useState<string>("");
  const [lembrarConta, setLembrarConta] = useState(false);
  const [necessitaConta, setNecessitaConta] = useState(false);
  const [bancoDetectado, setBancoDetectado] = useState<OfxNecessitaContaError["banco_detectado"] | null>(null);
  const [erroMensagem, setErroMensagem] = useState<string | null>(null);
  const [importacaoExistenteId, setImportacaoExistenteId] = useState<number | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      importarOfx({
        arquivo: arquivo!,
        conta_id: contaId ? Number(contaId) : undefined,
        lembrar_conta: lembrarConta,
      }),
    onSuccess: (resposta) => {
      navigate(`/importacoes-ofx/${resposta.data.id}`);
    },
    onError: (error: AxiosError<OfxNecessitaContaError | OfxArquivoDuplicadoError>) => {
      setErroMensagem(null);
      setImportacaoExistenteId(null);

      const data = error.response?.data;

      if (error.response?.status === 422 && data && "necessita_conta" in data) {
        setNecessitaConta(true);
        setBancoDetectado(data.banco_detectado);
        return;
      }

      if (error.response?.status === 409 && data && "importacao_existente" in data) {
        setErroMensagem(data.message);
        setImportacaoExistenteId(data.importacao_existente.id);
        return;
      }

      setErroMensagem(data?.message || "Erro ao importar o arquivo. Tente novamente.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!arquivo) {
      setErroMensagem("Selecione um arquivo .ofx para importar.");
      return;
    }

    mutate();
  };

  return (
    <PageLayout title="Nova Importação de Extrato" backTo="/importacoes-ofx" loading={isLoading}>
      <div className="container-fluid">
        <form onSubmit={handleSubmit} className="container mt-4" style={{ maxWidth: 560 }}>
          {erroMensagem && (
            <div className="alert alert-danger">
              {erroMensagem}
              {importacaoExistenteId && (
                <>
                  {" "}
                  <a href={`/importacoes-ofx/${importacaoExistenteId}`}>Ver importação existente</a>
                </>
              )}
            </div>
          )}

          <div className="form-group mb-3">
            <label className="form-label" htmlFor="arquivo_ofx">
              Arquivo OFX
            </label>
            <input
              id="arquivo_ofx"
              type="file"
              accept=".ofx,.qfx"
              className="form-control"
              onChange={(e) => setArquivo(e.target.files?.[0] || null)}
            />
            <small className="text-muted">Exporte o extrato do seu banco no formato OFX.</small>
          </div>

          {necessitaConta && (
            <div className="alert alert-warning">
              <p className="mb-1">
                <i className="bi bi-info-circle me-1"></i>
                Não reconhecemos automaticamente a conta deste arquivo. Selecione para qual conta do
                app ele deve ser importado.
              </p>
              {bancoDetectado?.acct_id && (
                <small className="text-muted d-block">
                  Origem detectada: banco {bancoDetectado.bank_id || "?"} • conta{" "}
                  {bancoDetectado.acct_id}
                </small>
              )}
            </div>
          )}

          <div className="form-group mb-3">
            <label className="form-label" htmlFor="conta_id">
              Importar para
            </label>
            <select
              id="conta_id"
              className="form-select"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
            >
              <option value="">Detectar automaticamente</option>
              {contas.map((conta: Conta) => (
                <option key={conta.id} value={conta.id}>
                  {conta.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-check form-switch mb-4">
            <input
              id="lembrar_conta"
              type="checkbox"
              role="switch"
              className="form-check-input"
              checked={lembrarConta}
              onChange={(e) => setLembrarConta(e.target.checked)}
            />
            <label htmlFor="lembrar_conta" className="form-check-label">
              Lembrar esta associação para próximas importações
            </label>
          </div>

          <div className="d-flex gap-2 justify-content-end">
            <button
              type="button"
              className="btn btn-secondary text-white"
              onClick={() => navigate("/importacoes-ofx")}
              disabled={isPending}
            >
              Cancelar
            </button>
            <button type="submit" className="btn btn-success" disabled={isPending}>
              {isPending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Importando...
                </>
              ) : (
                <>
                  <i className="bi bi-upload me-2"></i>
                  Importar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </PageLayout>
  );
}
