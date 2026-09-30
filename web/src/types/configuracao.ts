export const CONFIGURACAO_DIAS_MAXIMO = 7;

export type Configuracao = {
  /** Dias antes do vencimento em que o aviso começa (0 = desligado). */
  notify_upcoming_days: number;
  /** Quitar as faturas de cartão automaticamente no vencimento. */
  auto_pay_invoices: boolean;
  /** Dias após o vencimento em que o alerta de atraso continua (0 = desligado). */
  notify_overdue_days: number;
};
