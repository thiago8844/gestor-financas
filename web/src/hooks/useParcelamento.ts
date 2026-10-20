import { useCallback, useMemo, useState } from "react";
import { convertCurrencyMaskToNumber, convertNumberToCurrencyMask } from "../utils";
import {
  adicionarMesesISO,
  diferencaEntreSomaETotal,
  dividirEmCentavos,
  formatarDataISO,
  type ModoCentavos,
} from "../utils/parcelas";

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
  primeiraDataVencimento: string,
  modo: ModoCentavos
): ParcelaLinha[] {
  if (!valorTotal || valorTotal <= 0 || !total || total < 2 || !primeiraDataVencimento) {
    return [];
  }

  const centavos = dividirEmCentavos(valorTotal, total, modo);

  return centavos.map((valor, i) => ({
    number: i + 1,
    amount: convertNumberToCurrencyMask(valor / 100),
    date: "",
    due_date: adicionarMesesISO(primeiraDataVencimento, i),
    status: "PENDING" as StatusParcela,
  }));
}

export function useParcelamento() {
  const [valorTotal, setValorTotal] = useState("");
  const [installmentTotal, setInstallmentTotal] = useState(2);
  const [primeiraDataVencimento, setPrimeiraDataVencimento] = useState("");
  const [modoCentavos, setModoCentavos] = useState<ModoCentavos>("ultima");
  const [parcelas, setParcelas] = useState<ParcelaLinha[]>([]);

  const gerarParcelas = useCallback(() => {
    const valor = convertCurrencyMaskToNumber(valorTotal) ?? 0;
    setParcelas(gerarLinhas(valor, installmentTotal, primeiraDataVencimento, modoCentavos));
  }, [valorTotal, installmentTotal, primeiraDataVencimento, modoCentavos]);

  // Diferença entre a soma das parcelas (já editadas) e o total informado; 0 = confere com o banco.
  const diferenca = useMemo(() => {
    if (parcelas.length === 0) return 0;
    const valores = parcelas.map((p) => convertCurrencyMaskToNumber(p.amount) ?? 0);
    return diferencaEntreSomaETotal(valores, convertCurrencyMaskToNumber(valorTotal) ?? 0);
  }, [parcelas, valorTotal]);

  const atualizarParcela = useCallback(
    (index: number, dados: Partial<ParcelaLinha>) => {
      setParcelas((prev) =>
        prev.map((parcela, i) => {
          if (i !== index) return parcela;

          const atualizada = { ...parcela, ...dados };

          if (dados.status === "PAID" && !atualizada.date) {
            atualizada.date = formatarDataISO(new Date());
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
    setModoCentavos("ultima");
    setParcelas([]);
  }, []);

  return {
    valorTotal,
    setValorTotal,
    installmentTotal,
    setInstallmentTotal,
    primeiraDataVencimento,
    setPrimeiraDataVencimento,
    modoCentavos,
    setModoCentavos,
    diferenca,
    parcelas,
    gerarParcelas,
    atualizarParcela,
    reset,
  };
}
