import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import PageLayout from "../../layouts/PageLayout";
import { getTransferencia, updateTransferencia } from "../../api/transferencias";
import type { TransferenciaForm } from "../../schemas/transferencia";
import { convertNumberToCurrencyMask } from "../../utils";
import { TransferenciaFormulario } from "./TransferenciaFormulario";

export function EditarTransferencia() {
  const { id } = useParams<{ id: string }>();

  const {
    data: transferencia,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["transferencia", id],
    queryFn: () => getTransferencia(Number(id)),
    enabled: !!id,
    select: (response) => response.data,
  });

  const valoresIniciais = useMemo(
    () =>
      transferencia && {
        from_account_id: String(transferencia.from_account_id),
        to_account_id: String(transferencia.to_account_id),
        amount: convertNumberToCurrencyMask(Number(transferencia.amount)),
        date: transferencia.date_raw,
        description: transferencia.description ?? "",
      },
    [transferencia]
  );

  if (isError) {
    return (
      <PageLayout title="Editar Transferência" backTo="/transferencias">
        <div className="alert alert-danger">Erro ao carregar a transferência.</div>
      </PageLayout>
    );
  }

  return (
    <TransferenciaFormulario
      title="Editar Transferência"
      salvar={(data: TransferenciaForm) => updateTransferencia(Number(id), data)}
      mensagemSucesso="Transferência atualizada com sucesso!"
      valoresIniciais={valoresIniciais}
      loading={isLoading}
    />
  );
}
