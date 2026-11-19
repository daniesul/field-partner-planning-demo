import { useMemo, useState } from 'react';
import { LuArrowRight } from 'react-icons/lu';
import { BudgetStack } from '../components/charts';
import { Empty, FilterBar, FinanceChip, Kpi, KpiGrid, Legend, Note, Section, ViewHeader } from '../components/ui';
import { budgetBreakdown, filterInitiatives, isApproved, overviewMetrics, spendOf, sumSpend, budgetTotal, type BudgetDimension } from '../lib/calculations';
import { money, moneyShort, pct, signedMoney, signedShort } from '../lib/format';
import { useStore } from '../state/store';
import { EMPTY_FILTERS, REGION_LABEL, type Region } from '../types/models';

const DIMS: { id: BudgetDimension; label: string }[] = [
  { id: 'region', label: 'Region' },
  { id: 'source', label: 'Budget source' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'category', label: 'Category' },
];

const RULES = [
  { k: 'Proposed', d: 'Requested amount on Draft, Submitted or Under Review requests. Shown as “in planning” — never deducted from budget.' },
  { k: 'Approved', d: 'Amount authorised at approval. Rejected requests are always $0.' },
  { k: 'Committed', d: 'PO amount raised with finance (PO Issued, Invoiced or Closed).' },
  { k: 'Actual', d: 'Final reconciled spend after execution. Variance = approved − actual.' },
];

type TrackerFilter = 'all' | 'awaiting' | 'po' | 'reconciled' | 'variance';

export function Budget() {
  const { dataset, initiatives, filters, openInitiative } = useStore();
  const [dim, setDim] = useState<BudgetDimension>('region');
  const [tracker, setTracker] = useState<TrackerFilter>('all');
  const scoped = filterInitiatives(initiatives, filters);
  const totals = sumSpend(scoped, filters.source);
  const budget = budgetTotal(dataset, filters);
  const remaining = budget - totals.consumed;
  const rows = budgetBreakdown(dataset, initiatives, filters, dim);

  const ex = initiatives.find((i) => i.id === dataset.featured.reconciliationExampleId)!;
  const exSpend = spendOf(ex);
  const exPoolFilters = { ...EMPTY_FILTERS, region: ex.region, quarter: ex.quarter, source: ex.funding[0].source };
  const exPoolNow = overviewMetrics(dataset, initiatives, exPoolFilters);
  const exPoolBudget = budgetTotal(dataset, exPoolFilters);
  const exReconciled = ex.finance.actualSpend !== null;

  const tracked = useMemo(() => {
    const approved = scoped.filter(isApproved);
    const f = {
      all: () => true,
      awaiting: (i: (typeof approved)[number]) => i.finance.poAmount === null && i.executionStatus !== 'Cancelled',
      po: (i: (typeof approved)[number]) => i.finance.poAmount !== null && i.finance.actualSpend === null,
      reconciled: (i: (typeof approved)[number]) => i.finance.actualSpend !== null,
      variance: (i: (typeof approved)[number]) => i.finance.actualSpend !== null && i.finance.actualSpend !== i.approvedInvestment,
    }[tracker];
    return approved.filter(f).sort((a, b) => a.id.localeCompare(b.id));
  }, [scoped, tracker]);

  const sourceNote = filters.source !== 'All' ? ` Amounts show the ${filters.source} share of co-funded initiatives.` : '';

  return (
    <>
      <ViewHeader
        index="04"
        title="Regional budget allocation"
        lede="Marketing’s plan, reconciled to finance. Each initiative moves from proposed to approved, committed and actual — and only its most mature figure draws on budget, so nothing is counted twice."
      />
      <FilterBar />

      <div className="mt-8">
        <KpiGrid cols="grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
          <Kpi label="Budget" value={moneyShort(budget)} sub={filters.quarter === 'All' ? 'FY27 annual' : `FY27 ${filters.quarter}`} tone="ink" />
          <Kpi label="Requested · in planning" value={moneyShort(totals.proposed)} sub="Pending decisions" />
          <Kpi label="Approved" value={moneyShort(totals.approved)} sub={`${pct(budget ? totals.approved / budget : null)} of budget`} />
          <Kpi label="Committed (PO)" value={moneyShort(totals.committed)} sub="Raised with finance" />
          <Kpi label="Actual spend" value={moneyShort(totals.actual)} sub="Reconciled" />
          <Kpi label="Remaining" value={moneyShort(remaining)} sub={`${moneyShort(remaining - totals.proposed)} if all pending approved`} tone={remaining < 0 ? 'lime' : 'default'} />
          <Kpi label="Variance released" value={signedShort(totals.variance)} sub="Approved − actual" tone={totals.variance > 0 ? 'lime' : 'default'} />
        </KpiGrid>
        {sourceNote && (
          <div className="mt-3">
            <Note>{sourceNote.trim()}</Note>
          </div>
        )}
      </div>

      <section className="py-10 md:py-14 border-b border-line">
        <div className="eyebrow mb-4">Spend definitions</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          {RULES.map((r, idx) => (
            <div key={r.k} className="bg-white p-5">
              <div className="flex items-center gap-2">
                <span className="num text-[11px] text-mute">0{idx + 1}</span>
                <span className="font-display font-extrabold uppercase text-[18px]">{r.k}</span>
              </div>
              <p className="text-[13px] text-[#3a3a3a] mt-2 leading-relaxed">{r.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid md:grid-cols-2 gap-4 text-[13px] leading-relaxed">
          <p className="border-l-2 border-ink pl-4">
            <strong>Draw on budget</strong> = actual if reconciled, else PO amount if committed, else approved amount. Remaining = budget − draw.
          </p>
          <p className="border-l-2 border-ink pl-4">
            <strong>Co-funded initiatives</strong> are split by funding share with exact rounding, so every dollar appears in exactly one budget source.
          </p>
        </div>
      </section>

      <Section
        title="Spend breakdown"
        kicker="Budget vs. draw"
        aside={
          <div className="flex border border-ink" role="tablist">
            {DIMS.map((d) => (
              <button
                key={d.id}
                role="tab"
                aria-selected={dim === d.id}
                onClick={() => setDim(d.id)}
                className={`px-3 md:px-4 h-10 font-mono text-[11px] uppercase tracking-[0.06em] border-r border-ink last:border-r-0 ${dim === d.id ? 'bg-ink text-white' : 'hover:bg-white'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-5">
          <Legend
            items={[
              { label: 'Actual spend', swatch: 'bg-ink' },
              { label: 'Committed / approved, not yet spent', swatch: 'bg-mute' },
              { label: 'Proposed (in planning)', swatch: 'hatch bg-white' },
              { label: 'Budget', swatch: '!border-0 !w-[3px] !h-4 bg-ink' },
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="tbl min-w-[920px]">
            <thead>
              <tr>
                <th className="!bg-paper">{DIMS.find((d) => d.id === dim)!.label}</th>
                <th className="!bg-paper w-[28%]">Budget vs. draw</th>
                <th className="!bg-paper text-right">Budget</th>
                <th className="!bg-paper text-right">Proposed</th>
                <th className="!bg-paper text-right">Approved</th>
                <th className="!bg-paper text-right">Committed</th>
                <th className="!bg-paper text-right">Actual</th>
                <th className="!bg-paper text-right">Remaining</th>
                <th className="!bg-paper text-right">Variance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="font-medium whitespace-nowrap">{dim === 'region' ? REGION_LABEL[r.key as Region] : dim === 'quarter' ? `FY27 ${r.key}` : r.key}</td>
                  <td className="!align-middle">
                    <BudgetStack budget={r.budget} actual={r.actual} consumed={r.consumed} proposed={r.proposed} />
                  </td>
                  <td className="num text-right">{r.budget === null ? '—' : moneyShort(r.budget)}</td>
                  <td className="num text-right text-mute">{moneyShort(r.proposed)}</td>
                  <td className="num text-right">{moneyShort(r.approved)}</td>
                  <td className="num text-right">{moneyShort(r.committed)}</td>
                  <td className="num text-right">{moneyShort(r.actual)}</td>
                  <td className="num text-right">
                    {r.remaining === null ? '—' : <span className={r.remaining < 0 ? 'text-alert font-medium' : ''}>{moneyShort(r.remaining)}</span>}
                    {r.utilisation !== null && <div className="text-[11px] text-mute">{pct(r.utilisation)} used</div>}
                  </td>
                  <td className="num text-right">
                    <span className={r.variance > 0 ? 'bg-lime px-1' : r.variance < 0 ? 'text-alert' : ''}>{r.variance ? signedShort(r.variance) : '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {dim === 'category' && (
          <div className="mt-3">
            <Note>Budgets are allocated by region, quarter and source, not by category — so category rows show spend only.</Note>
          </div>
        )}
      </Section>

      <Section tour="reconcile" title="Reconciliation example" kicker="Approved $25,000 · executed for $21,000">
        <div className="grid lg:grid-cols-[1.1fr_1fr] gap-px bg-line border border-ink">
          <div className="bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="num text-[12px] text-mute">{ex.id}</span>
              <FinanceChip status={ex.finance.status} />
            </div>
            <button className="text-left" onClick={() => openInitiative(ex.id)}>
              <h3 className="display text-[30px] md:text-[38px] hover:underline decoration-2 underline-offset-4">{ex.name}</h3>
            </button>
            <p className="text-[13.5px] text-[#3a3a3a] mt-3 leading-relaxed">
              {REGION_LABEL[ex.region]} · {ex.quarter} · funded from {ex.funding[0].source}. Approved at {money(ex.approvedInvestment)} and committed on{' '}
              {ex.finance.poNumber ?? 'a PO'}; the event came in under budget.
            </p>
            <div className="mt-6 flex flex-wrap items-stretch gap-2">
              {[
                ['Approved', money(ex.approvedInvestment), 'bg-paper'],
                ['PO committed', money(ex.finance.poAmount), 'bg-paper'],
                ['Final actual', exReconciled ? money(ex.finance.actualSpend) : 'Pending', 'bg-ink text-white'],
                ['Released', exReconciled ? signedMoney(exSpend.variance) : '—', 'bg-lime'],
              ].map(([k, v, tone], idx) => (
                <div key={k} className="flex items-center gap-2">
                  <div className={`${tone} border border-ink px-4 py-3 min-w-[120px]`}>
                    <div className="font-mono text-[10px] uppercase tracking-[0.08em] opacity-70">{k}</div>
                    <div className="num text-[18px] mt-1">{v}</div>
                  </div>
                  {idx < 3 && <LuArrowRight className="text-mute hidden sm:block" aria-hidden />}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-paper p-6 md:p-8">
            <div className="eyebrow mb-4">
              Effect on {REGION_LABEL[ex.region]} {ex.quarter} · {ex.funding[0].source} pool
            </div>
            <dl className="space-y-3 text-[13.5px]">
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-mute">Pool budget</dt>
                <dd className="num">{money(exPoolBudget)}</dd>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-mute">Remaining while PO was the draw</dt>
                <dd className="num">{money(exPoolNow.remainingBudget - (exReconciled ? exSpend.variance : 0))}</dd>
              </div>
              <div className="flex justify-between border-b border-line pb-2">
                <dt className="text-mute">Remaining after reconciliation</dt>
                <dd className="num font-medium">{money(exPoolNow.remainingBudget)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="font-medium">Funding returned to the pool</dt>
                <dd className="num bg-lime px-1 font-medium">{exReconciled ? signedMoney(exSpend.variance) : '—'}</dd>
              </div>
            </dl>
            <p className="text-[12px] text-mute mt-5 leading-relaxed">
              Open the record and edit the actual spend to see this panel, the KPIs above and the Overview recalculate.
            </p>
            <button className="btn-ghost btn-sm mt-4" onClick={() => openInitiative(ex.id)}>
              Open record &amp; reconcile
            </button>
          </div>
        </div>
      </Section>

      <Section
        title="Finance reconciliation tracker"
        kicker="Approved initiatives · PO and actuals"
        aside={
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'All'],
                ['awaiting', 'Awaiting PO'],
                ['po', 'PO issued'],
                ['reconciled', 'Reconciled'],
                ['variance', 'With variance'],
              ] as [TrackerFilter, string][]
            ).map(([k, l]) => (
              <button key={k} onClick={() => setTracker(k)} className={`chip !py-1.5 !px-3 cursor-pointer ${tracker === k ? 'bg-ink text-white border-ink' : 'border-ink hover:bg-white'}`}>
                {l}
              </button>
            ))}
          </div>
        }
      >
        {tracked.length === 0 ? (
          <Empty>No approved initiatives in this view.</Empty>
        ) : (
          <div className="overflow-x-auto max-h-[640px] overflow-y-auto border-t border-ink">
            <table className="tbl min-w-[980px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Initiative</th>
                  <th>Finance status</th>
                  <th>PO #</th>
                  <th className="text-right">Approved</th>
                  <th className="text-right">PO amount</th>
                  <th className="text-right">Final actual</th>
                  <th className="text-right">Variance</th>
                  <th className="text-right">Draw on budget</th>
                </tr>
              </thead>
              <tbody>
                {tracked.map((i) => {
                  const s = spendOf(i);
                  return (
                    <tr key={i.id} className={`clickable ${i.id === ex.id ? 'bg-lime/30' : ''}`} onClick={() => openInitiative(i.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && openInitiative(i.id)}>
                      <td className="num text-[12px] text-mute whitespace-nowrap">{i.id}</td>
                      <td className="min-w-[240px]">
                        <div className="font-medium leading-snug">{i.name}</div>
                        <div className="text-[12px] text-mute">
                          {i.region} · {i.quarter} · {i.executionStatus}
                        </div>
                      </td>
                      <td>
                        <FinanceChip status={i.finance.status} />
                      </td>
                      <td className="num text-[12px] whitespace-nowrap">{i.finance.poNumber ?? '—'}</td>
                      <td className="num text-right">{money(i.approvedInvestment)}</td>
                      <td className="num text-right">{money(i.finance.poAmount)}</td>
                      <td className="num text-right">{money(i.finance.actualSpend)}</td>
                      <td className="num text-right">
                        {i.finance.actualSpend === null ? '—' : <span className={s.variance > 0 ? 'bg-lime px-1' : s.variance < 0 ? 'text-alert' : ''}>{signedMoney(s.variance)}</span>}
                      </td>
                      <td className="num text-right font-medium">{money(s.consumed)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
