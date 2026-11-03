import type { UseFormRegisterReturn } from "react-hook-form";

interface CampoDataCompetenciaProps {
  registro: UseFormRegisterReturn;
  rotulo: string;
  mensagemErro?: string;
}

// Data de competência (accrual_date): dia em que a compra/ganho aconteceu, usada nos relatórios por
// competência. Opcional: vazia, o sistema usa a data da transação (ou o vencimento).
export function CampoDataCompetencia({ registro, rotulo, mensagemErro }: CampoDataCompetenciaProps) {
  return (
    <div className="mb-3">
      <label htmlFor={registro.name} className="form-label">
        {rotulo}
      </label>
      <input type="date" id={registro.name} className="form-control" {...registro} />
      <div className="form-text">
        Dia em que aconteceu, para os relatórios por competência. Em branco, vale a data da transação.
      </div>
      {mensagemErro && <div className="text-danger small">{mensagemErro}</div>}
    </div>
  );
}
