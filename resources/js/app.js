import './bootstrap';
import './mask';
import * as bootstrap from 'bootstrap';
import Alpine from 'alpinejs';
import flatpickr from 'flatpickr';


window.Alpine = Alpine;
 
Alpine.start();


//TODO: CRIAR DIRETIVA ALPINE PARA APLICAR A MÁSCARA E CRIAR UM INPUT COM X-MODEL E O VALOR CONVERTIDO SEM MÁSCARA EMBAIXO
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

document.addEventListener('DOMContentLoaded', function() {
  flatpickr('.date-time', {
    enableTime: true,
    dateFormat: 'd/m/Y H:i',
    time_24hr: true,
    defaultDate: 'today',
  });

  flatpickr('.date', {
    dateFormat: 'd/m/Y H:i',
    defaultDate: 'today',
  });
});