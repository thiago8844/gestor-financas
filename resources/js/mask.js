import Cleave from 'cleave.js';

window.createMoneyMask = function (el) {

  const cleave = new Cleave(el, {
    numeral: true,
    numeralDecimalMark: ',',
    delimiter: '.',
    numeralDecimalScale: 2, // Ensures only 2 decimal places
    numeralIntegerScale: 15, // Allows up to 15 digits before the decimal
    numeralThousandsGroupStyle: 'thousand' // Groups thousands with a dot
  });

}

console.log('hello world');