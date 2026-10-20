import { useCallback, useEffect, useState } from "react";
import { convertCurrencyMaskToNumber } from "../utils";
import { diferencaEntreSomaETotal, formatarDataISO, type ModoCentavos } from "../utils/parcelas";
import { gerarPreviewParcelasCartao, type ParcelaPreview } from "../utils/fatura";
import type { Cartao } from "../types/cartao";

function hoje() {
  return formatarDataISO(new Date());
}

export function useDespesaCartao() {
  const [cardId, setCardId] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(hoje());
  const [installmentTotal, setInstallmentTotal] = useState(1);
  const [modoCentavos, setModoCentavos] = useState<ModoCentavos>("ultima");
  // Valores que o usuário editou à mão (índice da parcela -> máscara). Valem até mudar total, nº de parcelas ou modo.
  const [ajustes, setAjustes] = useState<Record<number, string>>({});

  useEffect(() => {
    setAjustes({});
  }, [valorTotal, installmentTotal, modoCentavos]);

  const gerarPreview = useCallback(
    (cartao: Cartao | undefined): ParcelaPreview[] => {
      if (!cartao) return [];
      const valor = convertCurrencyMaskToNumber(valorTotal) ?? 0;
      return gerarPreviewParcelasCartao(cartao, valor, purchaseDate, installmentTotal, modoCentavos).map((p, i) => ({
        ...p,
        amount: ajustes[i] !== undefined ? (convertCurrencyMaskToNumber(ajustes[i]) ?? 0) : p.amount,
      }));
    },
    [valorTotal, purchaseDate, installmentTotal, modoCentavos, ajustes]
  );

  const ajustarParcela = useCallback((index: number, mascara: string) => {
    setAjustes((prev) => ({ ...prev, [index]: mascara }));
  }, []);

  /** Valores finais de cada parcela, já com as edições manuais (para enviar ao backend). */
  const valoresParcelas = useCallback(
    (cartao: Cartao | undefined) => gerarPreview(cartao).map((p) => p.amount),
    [gerarPreview]
  );

  const diferencaPara = useCallback(
    (cartao: Cartao | undefined) => {
      const valores = valoresParcelas(cartao);
      if (valores.length === 0) return 0;
      return diferencaEntreSomaETotal(valores, convertCurrencyMaskToNumber(valorTotal) ?? 0);
    },
    [valoresParcelas, valorTotal]
  );

  const reset = useCallback(() => {
    setCardId("");
    setValorTotal("");
    setPurchaseDate(hoje());
    setInstallmentTotal(1);
    setModoCentavos("ultima");
    setAjustes({});
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
    modoCentavos,
    setModoCentavos,
    gerarPreview,
    ajustarParcela,
    valoresParcelas,
    diferencaPara,
    reset,
  };
}
