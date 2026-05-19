export function formatMoney(cents, currency = 'USD') {
  const value = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function formatQty(n) {
  if (n == null) return '0';
  return String(Math.max(0, Math.trunc(n)));
}
