/** Display formatting. Pure presentation — no business logic lives here. */

const full = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** $25,000 */
export const money = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : full.format(n));

/** $8.2M · $480K · $9,500 */
export function moneyShort(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n < 0 ? '−' : '';
  const a = Math.abs(n);
  if (a >= 1_000_000) {
    const v = a / 1_000_000;
    return `${sign}$${parseFloat(v.toFixed(v >= 10 ? 1 : 2))}M`;
  }
  if (a >= 10_000) return `${sign}$${Math.round(a / 1000)}K`;
  if (a >= 1_000) return `${sign}$${parseFloat((a / 1000).toFixed(1))}K`;
  return `${sign}${full.format(a)}`;
}

export const count = (n: number | null | undefined) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : int.format(Math.round(n)));

export const pct = (r: number | null | undefined, digits = 0) =>
  r === null || r === undefined || !Number.isFinite(r) ? '—' : `${(r * 100).toFixed(digits)}%`;

export const ratio = (r: number | null | undefined) => (r === null || r === undefined || !Number.isFinite(r) ? '—' : `${r.toFixed(1)}×`);

export const signedMoney = (n: number) => (n === 0 ? money(0) : `${n > 0 ? '+' : '−'}${money(Math.abs(n))}`);

export function date(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export const signedShort = (n: number) => (n === 0 ? moneyShort(0) : `${n > 0 ? '+' : '−'}${moneyShort(Math.abs(n))}`);
