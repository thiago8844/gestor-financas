import { EditarMultiplasTransacoes } from "../Transacoes/EditarMultiplasTransacoes";

export function EditarMultiplasReceitas() {
  return (
    <EditarMultiplasTransacoes
      tipo="INCOME"
      backTo="/receitas"
      titulo="Editar Múltiplas Receitas"
    />
  );
}
