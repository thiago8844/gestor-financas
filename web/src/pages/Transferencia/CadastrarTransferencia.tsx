import { criarTransferencia } from "../../api/transferencias";
import { TransferenciaFormulario } from "./TransferenciaFormulario";

export function CadastrarTransferencia() {
  return (
    <TransferenciaFormulario
      title="Nova Transferência"
      salvar={criarTransferencia}
      mensagemSucesso="Transferência criada com sucesso!"
    />
  );
}
