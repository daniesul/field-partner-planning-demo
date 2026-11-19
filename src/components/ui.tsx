import type { ReactNode } from 'react';
import { LuX } from 'react-icons/lu';
import { useStore } from '../state/store';
import type { ApprovalStatus, ExecutionStatus, FinanceStatus, Filters } from '../types/models';
import { BUDGET_SOURCES, CATEGORIES, QUARTERS, REGION_LABEL, REGIONS, SOLUTIONS } from '../types/models';
import { workflowStage, type WorkflowStage } from '../lib/calculations';
import type { Initiative } from '../types/models';

// ─────────────────────────────────────────────── layout

export function ViewHeader({ index, title, lede, children }: { index: string; title: string; lede: string; children?: ReactNode }) {
  return (
    <header data-tour="view-header" className="pt-10 pb-8 md:pt-16 md:pb-10 border-b border-ink">
      <div className="eyebrow mb-4">View {index} / 05</div>
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
        <h1 className="display text-[44px] xs:text-[56px] md:text-[84px] xl:text-[104px] max-w-[14ch]">{title}</h1>
        <div className="max-w-md lg:pb-2">
          <p className="text-[15px] leading-relaxed text-[#3a3a3a]">{lede}</p>
          {children}
        </div>
      </div>
    </header>
  );
}

export function Section({
  title,
  kicker,
  aside,
  children,
  className = '',
  tour,
}: {
  title: string;
  kicker?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Marks the section as a guided-tour target (data-tour). */
  tour?: string;
}) {
  return (
    <section data-tour={tour} className={`min-w-0 py-10 md:py-14 border-b border-line ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          {kicker && <div className="eyebrow mb-2">{kicker}</div>}
          <h2 className="display text-[28px] md:text-[40px]">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

// ─────────────────────────────────────────────── KPI

export function Kpi({
  label,
  value,
  sub,
  tone = 'default',
  className = '',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'ink' | 'lime';
  className?: string;
}) {
  const bg = tone === 'ink' ? 'bg-ink text-white' : tone === 'lime' ? 'bg-lime text-ink' : 'bg-white';
  return (
    <div className={`${bg} p-5 md:p-6 flex flex-col justify-between min-h-[128px] ${className}`}>
      <div className={`eyebrow ${tone === 'ink' ? '!text-[#a8a8a0]' : tone === 'lime' ? '!text-ink/70' : ''}`}>{label}</div>
      <div>
        <div className="num text-[30px] md:text-[36px] leading-none mt-4 font-medium">{value}</div>
        {sub && <div className={`mt-2 text-[12px] ${tone === 'ink' ? 'text-[#c8c8c0]' : tone === 'lime' ? 'text-ink/75' : 'text-mute'}`}>{sub}</div>}
      </div>
    </div>
  );
}

/** Grid of KPI tiles separated by 1px hairlines. */
export function KpiGrid({ children, cols = 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5' }: { children: ReactNode; cols?: string }) {
  return <div className={`grid ${cols} gap-px bg-line border border-line`}>{children}</div>;
}

// ─────────────────────────────────────────────── status chips

const STAGE_STYLE: Record<WorkflowStage, string> = {
  Draft: 'border-line text-mute bg-paper',
  Submitted: 'border-ink text-ink bg-white',
  'Under Review': 'border-ink text-ink bg-lime',
  Approved: 'border-ink text-white bg-ink',
  Rejected: 'border-line text-mute bg-white line-through decoration-1',
  Scheduled: 'border-ink text-white bg-ink',
  Executed: 'border-ink text-ink bg-white',
};

export function StageChip({ initiative }: { initiative: Initiative }) {
  const stage = workflowStage(initiative);
  return <span className={`chip ${STAGE_STYLE[stage]}`}>{stage}</span>;
}

export function ApprovalChip({ status }: { status: ApprovalStatus }) {
  return <span className={`chip ${STAGE_STYLE[status]}`}>{status}</span>;
}

export function ExecChip({ status }: { status: ExecutionStatus }) {
  const s = status === 'Executed' ? 'border-ink' : status === 'Cancelled' ? 'border-line text-mute line-through' : 'border-line text-[#3a3a3a]';
  return <span className={`chip ${s}`}>{status}</span>;
}

export function FinanceChip({ status }: { status: FinanceStatus }) {
  const s =
    status === 'Closed' ? 'border-ink bg-ink text-white' : status === 'PO Issued' || status === 'Invoiced' ? 'border-ink' : 'border-line text-mute';
  return <span className={`chip ${s}`}>{status}</span>;
}

// ─────────────────────────────────────────────── filters

type FilterKey = keyof Filters;

const FILTER_OPTIONS: Record<FilterKey, { label: string; options: { value: string; label: string }[] }> = {
  quarter: { label: 'Quarter', options: QUARTERS.map((q) => ({ value: q, label: `FY27 ${q}` })) },
  region: { label: 'Region', options: REGIONS.map((r) => ({ value: r, label: REGION_LABEL[r] })) },
  source: { label: 'Budget source', options: BUDGET_SOURCES.map((s) => ({ value: s, label: s })) },
  category: { label: 'Category', options: CATEGORIES.map((c) => ({ value: c, label: c })) },
  solution: { label: 'Solution', options: SOLUTIONS.map((s) => ({ value: s, label: s })) },
};

export function FilterBar({ keys = ['quarter', 'region', 'source', 'category', 'solution'], extra }: { keys?: FilterKey[]; extra?: ReactNode }) {
  const { filters, setFilters, clearFilters } = useStore();
  const active = keys.filter((k) => filters[k] !== 'All');
  return (
    <div data-tour="filters" className="sticky top-[var(--nav-h)] z-20 -mx-5 md:-mx-10 px-5 md:px-10 py-3 bg-paper/95 backdrop-blur border-b border-line">
      <div className="flex flex-wrap items-end gap-2 md:gap-3">
        {keys.map((k) => (
          <label key={k} className="flex-1 min-w-[140px] max-w-[220px]">
            <span className="eyebrow block mb-1">{FILTER_OPTIONS[k].label}</span>
            <select
              className={`select ${filters[k] !== 'All' ? '!border-ink !bg-lime' : ''}`}
              value={filters[k]}
              onChange={(e) => setFilters({ [k]: e.target.value } as Partial<Filters>)}
            >
              <option value="All">All</option>
              {FILTER_OPTIONS[k].options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {extra}
        {active.length > 0 && (
          <button className="btn-ghost btn-sm !h-10" onClick={clearFilters}>
            <LuX aria-hidden /> Clear {active.length}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── misc

export function Legend({ items }: { items: { label: string; swatch: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#3a3a3a]">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-2">
          <span className={`inline-block w-3.5 h-3.5 border border-ink ${i.swatch}`} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return <p className="text-[12px] text-mute leading-relaxed">{children}</p>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-16 text-center text-mute text-sm border border-dashed border-line">{children}</div>;
}
