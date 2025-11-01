import Cleave from "cleave.js/react";

export default function InputMoeda(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return (
    <div className="input-group">
      {/* TODO: COLOCAR SPAN BASEADO NA CURRENCIE SELECIONADA PELA CONTA */}
      {/* <span className="input-group-text"></span> */}
      <Cleave
        className="form-control"
        placeholder="0,00"
        options={{
          numeral: true,
          numeralThousandsGroupStyle: "thousand",
          numeralDecimalMark: ",",
          delimiter: ".",
          numeralDecimalScale: 2,
          noImmediatePrefix: true,
        }}
        {...props}
      />
    </div>
  );
}
