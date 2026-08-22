import { useCallback, useState } from "react";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask } from "../utils";

export type StatusParcela = "PENDING" | "PAID";

export type ParcelaLinha = {
  number: number;
  amount: string;
  date: string;
  due_date: string;
  status: StatusParcela;
};

function gerarLinhas(
  valorTotal: number,
  total: number,
  primeiraDataVencimento: string
): ParcelaLinha[] {
  if (!valorTotal || valorTotal <= 0 || !total || total < 2 || !primeiraDataVencimento) {
    return [];
  }

  const valorTotalCentavos = Math.round(valorTotal * 100);
  const parcelaCentavos = Math.floor(valorTotalCentavos / total);
  const restoCentavos = valorTotalCentavos - parcelaCentavos * total;

  const [ano, mes, dia] = primeiraDataVencimento.split("-").map(Number);

  return Array.from({ length: total }, (_, i) => {
    const centavosLinha = parcelaCentavos + (i === total - 1 ? restoCentavos : 0);

    const dataVencimento = new Date(ano, mes - 1 + i, dia);
    const dueDateFormatada = dataVencimento.toISOString().slice(0, 10);

    return {
      number: i + 1,
      amount: convertNumberToCurrencyMask(centavosLinha / 100),
      date: "",
      due_date: dueDateFormatada,
      status: "PENDING" as StatusParcela,
    };
  });
}

export function useParcelamento() {
  const [valorTotal, setValorTotal] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState(2);
  const [primeiraDataVencimento, setPrimeiraDataVencimento] = useState("");
  const [parcelas, setParcelas] = useState<ParcelaLinha[]>([]);

  const gerarParcelas = useCallback(() => {
    const valor = convertCurrencyMaskToNumber(valorTotal) ?? 0;
    setParcelas(gerarLinhas(valor, installmentTotal, primeiraDataVencimento));
  }, [valorTotal, installmentTotal, primeiraDataVencimento]);

  const atualizarParcela = useCallback(
    (index: number, dados: Partial<ParcelaLinha>) => {
      setParcelas((prev) =>
        prev.map((parcela, i) => {
          if (i !== index) return parcela;

          const atualizada = { ...parcela, ...dados };

          if (dados.status === "PAID" && !atualizada.date) {
            atualizada.date = new Date().toISOString().slice(0, 10);
          }

          if (dados.status === "PENDING") {
            atualizada.date = "";
          }

          return atualizada;
        })
      );
    },
    []
  );

  const reset = useCallback(() => {
    setValorTotal("");
    setInstallmentTotal(2);
    setPrimeiraDataVencimento("");
    setParcelas([]);
  }, []);

  return {
    valorTotal,
    setValorTotal,
    installmentTotal,
    setInstallmentTotal,
    primeiraDataVencimento,
    setPrimeiraDataVencimento,
    parcelas,
    gerarParcelas,
    atualizarParcela,
    reset,
  };
}
