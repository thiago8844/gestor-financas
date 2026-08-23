import { EditarMultiplasTransacoes } from "../Transacoes/EditarMultiplasTransacoes";

export function EditarMultiplasDespesas() {
  return (
    <EditarMultiplasTransacoes
      tipo="EXPENSE"
      backTo="/despesas"
      titulo="Editar Múltiplas Despesas"
    />
  );
}
