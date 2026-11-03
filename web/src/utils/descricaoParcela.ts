// Rótulo "1/7" de uma parcela. Compra à vista (ou sem parcelamento) não tem rótulo.
export function rotuloParcela(transacao: {
  installment_number?: number | null;
  installment_total?: number | null;
}): string | null {
  return (transacao.installment_total ?? 0) > 1 ? `${transacao.installment_number}/${transacao.installment_total}` : null;
}

// Versão em texto puro, para exportações (Excel etc.).
export function textoComParcela(descricao: string | null | undefined, parcela: string | null | undefined): string {
  return parcela ? `${descricao ?? ""} ${parcela}` : (descricao ?? "");
}
