import './bootstrap';
import './mask';

window.currencyToNumber = function (valorMonetario) {
  if (typeof valorMonetario !== 'string') {
    return valorMonetario; // Se não for string, retorna o valor original
  }

  // Remove todos os pontos (separadores de milhar)
  const semPontos = valorMonetario.replace(/\./g, '');

  // Substitui a vírgula (separador decimal) por ponto
  const comPonto = semPontos.replace(',', '.');

  // Converte a string para um número float
  const numero = parseFloat(comPonto);

  return isNaN(numero) ? undefined : numero; // Retorna undefined se a conversão falhar
}