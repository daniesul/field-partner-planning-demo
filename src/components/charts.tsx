/**
 * Lightweight, dependency-free chart primitives (HTML/CSS bars).
 * Monochrome by design: ink = committed, hatch = proposed, lime = gap / selection.
 * Every mark carries a hover tooltip (title) and the values are always printed
 * alongside, so nothing is encoded by color alone.
 */
import { moneyShort, pct } from '../lib/format';

const w = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / (max || 1)) * 100))}%`;

/** Forecast vs. target: approved (ink) + proposed (hatch) against a target tick; the shortfall reads lime. */
export function BulletBar({
  target,
  approved,
  proposed = 0,
  max,
  height = 'h-7',
  showGap = true,
  label,
}: {
  target: number;
  approved: number;
  proposed?: number;
  max?: number;
  height?: string;
  showGap?: boolean;
  label?: string;
}) {
  const scale = max ?? Math.max(target, approved + proposed) * 1.08;
  const gap = Math.max(target - approved, 0);
  return (
    <div
      className={`relative ${height} bg-white border border-line`}
      role="img"
      aria-label={`${label ?? 'Forecast'}: ${moneyShort(approved)} approved, ${moneyShort(proposed)} proposed, target ${moneyShort(target)}`}
    >
      {showGap && gap > 0 && (
        <div
          className="absolute inset-y-0 bg-lime bar-anim"
          style={{ left: w(approved, scale), width: w(gap, scale) }}
          title={`Gap to target: ${moneyShort(gap)}`}
        />
      )}
      <div className="absolute inset-y-0 left-0 bg-ink bar-anim" style={{ width: w(approved, scale) }} title={`Approved forecast: ${moneyShort(approved)}`} />
      {proposed > 0 && (
        <div
          className="absolute inset-y-[22%] hatch border-y border-r border-ink/60 bar-anim"
          style={{ left: w(approved, scale), width: w(proposed, scale) }}
          title={`Proposed (pending approval): ${moneyShort(proposed)}`}
        />
      )}
      <div className="absolute -inset-y-1.5 w-[2px] bg-ink bar-anim" style={{ left: `calc(${w(target, scale)} - 1px)` }} title={`Target: ${moneyShort(target)}`} />
    </div>
  );
}

/** Simple horizontal magnitude bar. */
export function HBar({ value, max, tone = 'ink', title }: { value: number; max: number; tone?: 'ink' | 'mute' | 'lime'; title?: string }) {
  const bg = tone === 'ink' ? 'bg-ink' : tone === 'lime' ? 'bg-lime border border-ink' : 'bg-soft';
  return (
    <div className="relative h-2.5 w-full bg-line/60" title={title}>
      <div className={`absolute inset-y-0 left-0 ${bg} bar-anim`} style={{ width: w(value, max) }} />
    </div>
  );
}

/** Coverage meter scaled 0–120% with a 100% marker. Under-coverage is flagged lime. */
export function CoverageMeter({ value, threshold = 0.9 }: { value: number | null; threshold?: number }) {
  const v = value ?? 0;
  const under = value !== null && v < threshold;
  return (
    <div className="relative h-2 w-full bg-line" title={`Coverage ${pct(value)}`}>
      <div className={`absolute inset-y-0 left-0 bar-anim ${under ? 'bg-lime outline outline-1 outline-ink' : 'bg-ink'}`} style={{ width: w(v, 1.2) }} />
      <div className="absolute -inset-y-1 w-px bg-ink" style={{ left: `${(1 / 1.2) * 100}%` }} />
    </div>
  );
}

/** Budget consumption: actual (ink) + committed/approved not yet spent (grey) + proposed (hatch) vs. budget. */
export function BudgetStack({ budget, actual, consumed, proposed }: { budget: number | null; actual: number; consumed: number; proposed: number }) {
  const total = consumed + proposed;
  const scale = Math.max(budget ?? 0, total) * 1.05 || 1;
  const open = Math.max(consumed - actual, 0);
  const over = budget !== null && consumed > budget;
  return (
    <div className="relative h-5 bg-white border border-line">
      <div className="absolute inset-y-0 left-0 bg-ink bar-anim" style={{ width: w(actual, scale) }} title={`Actual spend: ${moneyShort(actual)}`} />
      <div
        className="absolute inset-y-0 bg-mute bar-anim"
        style={{ left: w(actual, scale), width: w(open, scale) }}
        title={`Committed / approved, not yet spent: ${moneyShort(open)}`}
      />
      <div
        className="absolute inset-y-[18%] hatch border-y border-r border-ink/50 bar-anim"
        style={{ left: w(consumed, scale), width: w(proposed, scale) }}
        title={`Proposed (in planning): ${moneyShort(proposed)}`}
      />
      {budget !== null && (
        <div
          className={`absolute -inset-y-1.5 w-[3px] ${over ? 'bg-alert' : 'bg-ink'} bar-anim`}
          style={{ left: `calc(${w(budget, scale)} - 1px)` }}
          title={`Budget: ${moneyShort(budget)}`}
        />
      )}
    </div>
  );
}
