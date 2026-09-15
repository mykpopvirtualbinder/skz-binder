export type CurrencyOption = {
  code: string;
  name: string;
  symbol: string;
};

const CURRENCY_CODES = [
  { code: "AUD", symbol: "A$" },
  { code: "BRL", symbol: "R$" },
  { code: "CAD", symbol: "C$" },
  { code: "CHF", symbol: "CHF" },
  { code: "CNY", symbol: "¥" },
  { code: "DKK", symbol: "kr" },
  { code: "EUR", symbol: "€" },
  { code: "GBP", symbol: "£" },
  { code: "HKD", symbol: "HK$" },
  { code: "IDR", symbol: "Rp" },
  { code: "INR", symbol: "₹" },
  { code: "JPY", symbol: "¥" },
  { code: "KRW", symbol: "₩" },
  { code: "MXN", symbol: "MX$" },
  { code: "MYR", symbol: "RM" },
  { code: "NOK", symbol: "kr" },
  { code: "NZD", symbol: "NZ$" },
  { code: "PHP", symbol: "₱" },
  { code: "SEK", symbol: "kr" },
  { code: "SGD", symbol: "S$" },
  { code: "THB", symbol: "฿" },
  { code: "TRY", symbol: "₺" },
  { code: "USD", symbol: "$" },
  { code: "VND", symbol: "₫" },
  { code: "ZAR", symbol: "R" },
];

/**
 * Genera la lista de divisas con nombres traducidos.
 * @param lang Código de idioma (es, en, ko, etc.)
 */
export const getCurrencyOptions = (lang: string = "es"): CurrencyOption[] => {
  try {
    const displayNames = new Intl.DisplayNames([lang], { type: "currency" });
    
    return CURRENCY_CODES.map((curr) => ({
      ...curr,
      name: displayNames.of(curr.code) ?? curr.code,
    })).sort((a, b) => a.code.localeCompare(b.code));
    
  } catch (e) {
    // Fallback en inglés si algo falla
    return CURRENCY_CODES.map((curr) => ({
      ...curr,
      name: curr.code, // Al menos mostramos el código (USD, EUR...)
    })).sort((a, b) => a.code.localeCompare(b.code));
  }
};

// Mantenemos la exportación antigua para compatibilidad inmediata
export const CURRENCY_OPTIONS = getCurrencyOptions("es");