/**
 * Converte string com máscara monetária para number
 * @param maskedValue - Valor com máscara (ex: "R$ 1.500,50")
 * @returns number ou undefined se inválido
 */
export function convertCurrencyMaskToNumber(
  maskedValue?: string
): number | undefined {
  // If empty or undefined, return undefined
  if (!maskedValue || maskedValue.trim() === "") return undefined;

  // Remove mask: "R$ 1.500,50" → 1500.50
  const cleanValue = maskedValue
    .replace(/[R$\s]/g, "") // Remove R$, spaces
    .replace(/\./g, "") // Remove dots (thousands separator)
    .replace(",", "."); // Replace comma with dot for decimal

  const numValue = parseFloat(cleanValue);

  // Return undefined if not a valid number
  return isNaN(numValue) ? undefined : numValue;
}

/**
 * Converte number para string com máscara monetária BRL
 * @param value - Número para converter
 * @returns string formatada (ex: "R$ 1.500,50")
 */
export function convertNumberToCurrencyMask(value?: number): string {
  if (!value && value !== 0) return "";

  return new Intl.NumberFormat("pt-BR", {
    style: "decimal",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}


  export const getBrazilDateTime = (): string => {
    const now = new Date();
    // Ajusta para timezone do Brasil (UTC-3)
    const brazilTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60000));
    return brazilTime.toISOString().slice(0, 16);
  };
