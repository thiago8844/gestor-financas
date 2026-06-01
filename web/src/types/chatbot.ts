export type DadosFinanceirosResponse = {
  dados_financeiros: {
    periodo_meses: number;
    patrimonio_liquido: number;
    renda: {
      media_mensal: number;
      desvio_padrao: number;
      desvio_padrao_percentual: number;
    };
    despesas: {
      media_mensal: number;
      desvio_padrao: number;
      desvio_padrao_percentual: number;
    };
    saldo: {
      medio_mensal: number;
      tendencia_percentual: number;
    };
    regras_interpretacao: {
      desvio_padrao: string;
      tendencia_saldo: string;
      orientacao: string;
    };
  };
  prompt: string;
};

export type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
}
