import { useCallback, useState } from "react";
import { convertCurrencyMaskToNumber } from "../utils";
import { gerarPreviewParcelasCartao, type ParcelaPreview } from "../utils/fatura";
import type { Cartao } from "../types/cartao";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export function useDespesaCartao() {
  const [cardId, setCardId] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(hoje());
  const [installmentTotal, setInstallmentTotal] = useState(1);

  const gerarPreview = useCallback(
    (cartao: Cartao | undefined): ParcelaPreview[] => {
      if (!cartao) return [];
      const valor = convertCurrencyMaskToNumber(valorTotal) ?? 0;
      return gerarPreviewParcelasCartao(cartao, valor, purchaseDate, installmentTotal);
    },
    [valorTotal, purchaseDate, installmentTotal]
  );

  const reset = useCallback(() => {
    setCardId("");
    setValorTotal("");
    setPurchaseDate(hoje());
    setInstallmentTotal(1);
  }, []);

  return {
    cardId,
    setCardId,
    valorTotal,
    setValorTotal,
    purchaseDate,
    setPurchaseDate,
    installmentTotal,
    setInstallmentTotal,
    gerarPreview,
    reset,
  };
}
