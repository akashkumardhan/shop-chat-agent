/**
 * Shared formatting helpers for the dashboard components.
 * Pure functions — no React, no DOM, no I/O.
 */

export function formatCurrency({ amount, currencyCode }) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (_) {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatNumber(n) {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatDeltaPercent(d) {
  const sign = d > 0 ? '↑' : d < 0 ? '↓' : '→';
  return `${sign} ${Math.abs(d).toFixed(1)}%`;
}
