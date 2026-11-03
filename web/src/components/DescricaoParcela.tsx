// Descrição de um lançamento com o rótulo da parcela ao lado (ex.: "Notebook 1/7").
// Sem parcela, mostra só a descrição.
export function DescricaoParcela({ descricao, parcela }: { descricao: string | null | undefined; parcela: string | null | undefined }) {
  return (
    <>
      {descricao}
      {parcela && <span className="text-muted ms-1">{parcela}</span>}
    </>
  );
}
