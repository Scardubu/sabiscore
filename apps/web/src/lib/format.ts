/**
 * Formatting helpers for frontend
 */
export function formatCurrency(amount: number | null | undefined, locale = 'en-NG', currency = 'NGN') {
  if (amount == null || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch (e) {
    // fallback
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

export function formatNumber(n: number | null | undefined, locale = 'en-NG', digits = 2) {
  if (n == null || Number.isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  } catch (e) {
    return Number(n).toFixed(digits);
  }
}
