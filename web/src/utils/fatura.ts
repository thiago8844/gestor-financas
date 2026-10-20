import { dividirEmCentavos, type ModoCentavos } from "./parcelas";

export type ParcelaPreview = {
  number: number;
  amount: number;
  referenceMonth: Date;
  dueDate: Date;
};

type CartaoDias = { closing_day: number; due_day: number };

function ultimoDiaDoMes(ano: number, mesIndex0: number) {
  return new Date(ano, mesIndex0 + 1, 0).getDate();
}

/**
 * Mesmo cálculo do backend (App\Actions\Faturas\ResolverFaturaCompra) para preview no formulário.
 * Determina o ciclo de fechamento (mês) em que a compra cai — passo intermediário, o mês
 * "oficial" da fatura é o mês do vencimento correspondente a esse fechamento (ver vencimentoDaFatura).
 */
export function referenciaParaCompra(cartao: CartaoDias, dataCompra: Date): Date {
  const ciclo = new Date(dataCompra.getFullYear(), dataCompra.getMonth(), 1);

  if (dataCompra.getDate() > cartao.closing_day) {
    ciclo.setMonth(ciclo.getMonth() + 1);
  }

  return ciclo;
}

/** Vencimento correspondente ao ciclo de fechamento informado. */
export function vencimentoDaFatura(cartao: CartaoDias, ciclo: Date): Date {
  const mesVencimento = new Date(ciclo);

  if (cartao.due_day <= cartao.closing_day) {
    mesVencimento.setMonth(mesVencimento.getMonth() + 1);
  }

  const dia = Math.min(cartao.due_day, ultimoDiaDoMes(mesVencimento.getFullYear(), mesVencimento.getMonth()));

  return new Date(mesVencimento.getFullYear(), mesVencimento.getMonth(), dia);
}

export function gerarPreviewParcelasCartao(
  cartao: CartaoDias,
  valorTotal: number,
  dataCompraStr: string,
  installmentTotal: number,
  modo: ModoCentavos = "ultima"
): ParcelaPreview[] {
  if (!valorTotal || valorTotal <= 0 || !dataCompraStr || installmentTotal < 1) {
    return [];
  }

  const [ano, mes, dia] = dataCompraStr.split("-").map(Number);
  const dataCompra = new Date(ano, mes - 1, dia);

  const centavos = dividirEmCentavos(valorTotal, installmentTotal, modo);

  const cicloInicial = referenciaParaCompra(cartao, dataCompra);

  return Array.from({ length: installmentTotal }, (_, i) => {
    const ciclo = new Date(cicloInicial);
    ciclo.setMonth(ciclo.getMonth() + i);

    const dueDate = vencimentoDaFatura(cartao, ciclo);
    return {
      number: i + 1,
      amount: centavos[i] / 100,
      // O mês "oficial" da fatura é o mês do vencimento, não o do ciclo de fechamento.
      referenceMonth: new Date(dueDate.getFullYear(), dueDate.getMonth(), 1),
      dueDate,
    };
  });
}
