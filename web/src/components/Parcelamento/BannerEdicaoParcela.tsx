import { Link } from "react-router-dom";
import type { Transacao } from "../../types/transacao";

type Props = {
  transacao: Transacao | undefined;
  /** Prefixo da área (/despesas ou /receitas), usado para abrir a edição do grupo. */
  basePath: "/despesas" | "/receitas";
};

/**
 * Fica fixo no topo da edição de uma parcela: o usuário vê que está editando só esta parcela
 * e pode, a qualquer momento, trocar para a edição de todas as parcelas da compra.
 */
export function BannerEdicaoParcela({ transacao, basePath }: Props) {
  if (!transacao?.installment_group || (transacao.installment_total ?? 0) <= 1) return null;

  return (
    <div className="alert alert-info d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
      <span>
        <i className="bi bi-layers me-2"></i>
        Você está editando <strong>somente a parcela {transacao.installment_number}/{transacao.installment_total}</strong> desta
        compra parcelada.
      </span>
      <Link to={`${basePath}/grupo/${transacao.installment_group}`} className="btn btn-primary btn-sm">
        <i className="bi bi-pencil-square me-2"></i>
        Editar todas as parcelas
      </Link>
    </div>
  );
}
