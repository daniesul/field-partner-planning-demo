import { describe, expect, it } from 'vitest';
import { loadInitialDataset } from '../data';
import type { Filters, Initiative } from '../types/models';
import { BUDGET_SOURCES, EMPTY_FILTERS, QUARTERS, REGIONS } from '../types/models';
import {
  allocate,
  applyFinance,
  applyWorkflow,
  budgetBreakdown,
  budgetTotal,
  isLive,
  isPending,
  overviewMetrics,
  pipelineCell,
  pipelineMatrix,
  safeRatio,
  spendOf,
  sumSpend,
  WorkflowError,
} from './calculations';

const ds = loadInitialDataset();
const ALL: Filters = EMPTY_FILTERS;
const NA_Q3: Filters = { ...ALL, region: 'NA', quarter: 'Q3' };

describe('synthetic dataset integrity', () => {
  it('has 100–150 initiatives with unique IDs across a full fiscal year', () => {
    expect(ds.initiatives.length).toBeGreaterThanOrEqual(100);
    expect(ds.initiatives.length).toBeLessThanOrEqual(150);
    expect(new Set(ds.initiatives.map((i) => i.id)).size).toBe(ds.initiatives.length);
    for (const r of REGIONS) for (const q of QUARTERS) {
      expect(ds.initiatives.some((i) => i.region === r && i.quarter === q)).toBe(true);
    }
  });

  it('keeps every record internally consistent', () => {
    for (const i of ds.initiatives) {
      const shares = i.funding.reduce((s, f) => s + f.share, 0);
      expect(shares).toBeCloseTo(1, 9);
      expect(i.requestedInvestment).toBeGreaterThan(0);
      if (i.approvalStatus !== 'Approved') expect(i.approvedInvestment).toBe(0);
      else expect(i.approvedInvestment).toBeLessThanOrEqual(i.requestedInvestment);
      if (i.finance.poAmount !== null) expect(i.finance.poNumber).toBeTruthy();
      if (i.finance.actualSpend !== null) expect(i.approvalStatus).toBe('Approved');
      if (i.approvalStatus !== 'Approved') expect(i.finance.poAmount).toBeNull();
    }
  });

  it('has a budget and target for every region and quarter', () => {
    for (const r of REGIONS) for (const q of QUARTERS) {
      expect(budgetTotal(ds, { region: r, quarter: q, source: 'All' })).toBeGreaterThan(0);
      expect(ds.targets.find((t) => t.region === r && t.quarter === q)).toBeDefined();
    }
  });
});

describe('funding allocation (no double counting)', () => {
  it('splits amounts into pieces that sum exactly to the whole', () => {
    const funding = [
      { source: 'AWS MDF' as const, share: 0.7 },
      { source: 'Partner Co-Investment' as const, share: 0.3 },
    ];
    for (const amt of [1, 3, 999, 25001, 33333]) {
      const parts = allocate(amt, funding);
      expect(Object.values(parts).reduce((s, v) => s + (v ?? 0), 0)).toBe(amt);
    }
  });

  it('source-level spend adds back to the overall total', () => {
    const total = sumSpend(ds.initiatives);
    const rows = budgetBreakdown(ds, ds.initiatives, ALL, 'source');
    for (const k of ['proposed', 'approved', 'committed', 'actual', 'consumed', 'variance'] as const) {
      expect(rows.reduce((s, r) => s + r[k], 0)).toBe(total[k]);
    }
    expect(rows.reduce((s, r) => s + (r.budget ?? 0), 0)).toBe(budgetTotal(ds, ALL));
  });

  it('region and quarter breakdowns reconcile to the global totals', () => {
    const total = sumSpend(ds.initiatives);
    for (const dim of ['region', 'quarter'] as const) {
      const rows = budgetBreakdown(ds, ds.initiatives, ALL, dim);
      expect(rows.reduce((s, r) => s + r.consumed, 0)).toBe(total.consumed);
      expect(rows.reduce((s, r) => s + (r.budget ?? 0), 0)).toBe(budgetTotal(ds, ALL));
    }
  });

  it('a budget-source filter never counts more than the unfiltered total', () => {
    const all = overviewMetrics(ds, ds.initiatives, ALL);
    const bySource = BUDGET_SOURCES.map((s) => overviewMetrics(ds, ds.initiatives, { ...ALL, source: s }));
    expect(bySource.reduce((s, m) => s + m.approvedInvestment, 0)).toBe(all.approvedInvestment);
    expect(bySource.reduce((s, m) => s + m.forecastPipeline, 0)).toBe(all.forecastPipeline);
  });
});

describe('spend states', () => {
  const base = ds.initiatives.find((i) => i.approvalStatus === 'Approved')!;
  const make = (over: Partial<Initiative>): Initiative => ({ ...base, ...over, finance: { ...base.finance, ...(over.finance ?? {}) } });

  it('pending requests are proposed only and never consume budget', () => {
    const s = spendOf(make({ approvalStatus: 'Submitted', approvedInvestment: 0, requestedInvestment: 10000, finance: { status: 'Not Submitted', poNumber: null, poAmount: null, actualSpend: null } }));
    expect(s).toMatchObject({ proposed: 10000, approved: 0, consumed: 0 });
  });

  it('rejected requests contribute nothing', () => {
    const s = spendOf(make({ approvalStatus: 'Rejected', approvedInvestment: 0, finance: { status: 'Not Submitted', poNumber: null, poAmount: null, actualSpend: null } }));
    expect(Object.values(s).every((v) => v === 0)).toBe(true);
  });

  it('consumption uses the most mature figure: actual → PO → approved', () => {
    const approvedOnly = make({ approvedInvestment: 20000, executionStatus: 'Scheduled', finance: { status: 'Not Submitted', poNumber: null, poAmount: null, actualSpend: null } });
    expect(spendOf(approvedOnly).consumed).toBe(20000);
    const withPo = make({ approvedInvestment: 20000, executionStatus: 'Scheduled', finance: { status: 'PO Issued', poNumber: 'PO-1', poAmount: 18000, actualSpend: null } });
    expect(spendOf(withPo)).toMatchObject({ committed: 18000, consumed: 18000 });
    const withActual = make({ approvedInvestment: 20000, executionStatus: 'Executed', finance: { status: 'Closed', poNumber: 'PO-1', poAmount: 18000, actualSpend: 17250 } });
    expect(spendOf(withActual)).toMatchObject({ actual: 17250, consumed: 17250, variance: 2750 });
  });

  it('cancelled initiatives without an actual release their budget', () => {
    const s = spendOf(make({ approvedInvestment: 20000, executionStatus: 'Cancelled', finance: { status: 'Closed', poNumber: 'PO-1', poAmount: 20000, actualSpend: null } }));
    expect(s.consumed).toBe(0);
  });
});

describe('reconciliation example — approved $25,000, executed for $21,000', () => {
  const ex = ds.initiatives.find((i) => i.id === ds.featured.reconciliationExampleId)!;

  it('reports a $4,000 favourable variance', () => {
    expect(ex.approvedInvestment).toBe(25000);
    expect(ex.finance.actualSpend).toBe(21000);
    expect(spendOf(ex).variance).toBe(4000);
  });

  it('releases the $4,000 back to remaining budget', () => {
    const f: Filters = { ...ALL, region: ex.region, quarter: ex.quarter };
    const reconciled = overviewMetrics(ds, ds.initiatives, f).remainingBudget;
    const unreconciled = ds.initiatives.map((i) =>
      i.id === ex.id ? { ...i, finance: { ...i.finance, status: 'PO Issued' as const, actualSpend: null } } : i,
    );
    expect(reconciled - overviewMetrics(ds, unreconciled, f).remainingBudget).toBe(4000);
  });
});

describe('investment-to-pipeline planning — North America Q3', () => {
  const exId = ds.featured.pipelineExampleId;

  it('starts at a $10M target, $8.2M approved forecast and a $1.8M gap', () => {
    const c = pipelineCell(ds, ds.initiatives, NA_Q3);
    expect(c.pipelineTarget).toBe(10_000_000);
    expect(c.approvedPipeline).toBe(8_200_000);
    expect(c.gap).toBe(1_800_000);
    expect(c.coverage).toBeCloseTo(0.82, 10);
  });

  it('approving the $500K proposal lifts the forecast to $8.7M and cuts the gap to $1.3M', () => {
    const next = applyWorkflow(ds.initiatives, exId, 'approve');
    const c = pipelineCell(ds, next, NA_Q3);
    expect(c.approvedPipeline).toBe(8_700_000);
    expect(c.gap).toBe(1_300_000);
    const before = overviewMetrics(ds, ds.initiatives, NA_Q3);
    const after = overviewMetrics(ds, next, NA_Q3);
    const req = ds.initiatives.find((i) => i.id === exId)!.requestedInvestment;
    expect(after.approvedInvestment - before.approvedInvestment).toBe(req);
    expect(before.remainingBudget - after.remainingBudget).toBe(req);
    expect(after.pendingApproval).toBe(before.pendingApproval - 1);
  });

  it('rejecting the proposal leaves approved forecast and investment unchanged', () => {
    const next = applyWorkflow(ds.initiatives, exId, 'reject');
    const c = pipelineCell(ds, next, NA_Q3);
    expect(c.approvedPipeline).toBe(8_200_000);
    expect(c.proposedPipeline).toBe(pipelineCell(ds, ds.initiatives, NA_Q3).proposedPipeline - 500_000);
    expect(overviewMetrics(ds, next, NA_Q3).approvedInvestment).toBe(overviewMetrics(ds, ds.initiatives, NA_Q3).approvedInvestment);
  });

  it('keeps influenced pipeline and deal-registration value out of new pipeline', () => {
    const live = ds.initiatives.filter((i) => i.region === 'NA' && i.quarter === 'Q3' && isLive(i));
    const c = pipelineCell(ds, ds.initiatives, NA_Q3);
    expect(c.approvedPipeline).toBe(live.reduce((s, i) => s + i.expected.newPipeline, 0));
    expect(c.influencedPipeline).toBe(live.reduce((s, i) => s + i.expected.influencedPipeline, 0));
    expect(c.dealRegValue).toBe(live.reduce((s, i) => s + i.expected.dealRegValue, 0));
  });

  it('matrix cells add up to the global view', () => {
    const cells = pipelineMatrix(ds, ds.initiatives, ALL);
    const global = pipelineCell(ds, ds.initiatives, ALL);
    expect(cells.reduce((s, c) => s + c.approvedPipeline, 0)).toBe(global.approvedPipeline);
    expect(cells.reduce((s, c) => s + c.pipelineTarget, 0)).toBe(global.pipelineTarget);
  });
});

describe('approval workflow', () => {
  const draft = ds.initiatives.find((i) => i.approvalStatus === 'Draft')!;
  const approved = ds.initiatives.find((i) => i.approvalStatus === 'Approved')!;

  it('follows Draft → Submitted → Under Review → Approved', () => {
    let list = applyWorkflow(ds.initiatives, draft.id, 'submit');
    expect(list.find((i) => i.id === draft.id)!.approvalStatus).toBe('Submitted');
    list = applyWorkflow(list, draft.id, 'review');
    expect(list.find((i) => i.id === draft.id)!.approvalStatus).toBe('Under Review');
    list = applyWorkflow(list, draft.id, 'approve');
    const done = list.find((i) => i.id === draft.id)!;
    expect(done).toMatchObject({ approvalStatus: 'Approved', executionStatus: 'Scheduled', approvedInvestment: draft.requestedInvestment });
  });

  it('blocks invalid transitions', () => {
    expect(() => applyWorkflow(ds.initiatives, draft.id, 'approve')).toThrow(WorkflowError);
    expect(() => applyWorkflow(ds.initiatives, approved.id, 'reject')).toThrow(WorkflowError);
    expect(() => applyWorkflow(ds.initiatives, 'nope', 'approve')).toThrow(WorkflowError);
  });

  it('does not mutate the original records (reset restores the known state)', () => {
    const pending = ds.initiatives.find(isPending)!;
    const snapshot = JSON.stringify(ds.initiatives);
    applyWorkflow(ds.initiatives, pending.id, pending.approvalStatus === 'Draft' ? 'submit' : 'reject');
    expect(JSON.stringify(ds.initiatives)).toBe(snapshot);
    expect(JSON.stringify(loadInitialDataset().initiatives)).toBe(snapshot);
  });
});

describe('finance reconciliation updates', () => {
  const scheduled = ds.initiatives.find((i) => i.approvalStatus === 'Approved' && i.executionStatus === 'Scheduled')!;
  const pending = ds.initiatives.find(isPending)!;

  it('rejects invalid input', () => {
    expect(applyFinance(ds.initiatives, scheduled.id, { actualSpend: -5 }).result.ok).toBe(false);
    expect(applyFinance(ds.initiatives, scheduled.id, { actualSpend: Number.NaN }).result.ok).toBe(false);
    expect(applyFinance(ds.initiatives, scheduled.id, { poNumber: null, poAmount: 1000 }).result.ok).toBe(false);
    expect(applyFinance(ds.initiatives, pending.id, { actualSpend: 1000 }).result.ok).toBe(false);
  });

  it('recording an actual closes the initiative and updates remaining budget', () => {
    const f: Filters = { ...ALL, region: scheduled.region, quarter: scheduled.quarter };
    const before = overviewMetrics(ds, ds.initiatives, f);
    const actual = scheduled.approvedInvestment - 1500;
    const { list, result } = applyFinance(ds.initiatives, scheduled.id, { poNumber: 'PO-TEST', poAmount: scheduled.approvedInvestment, actualSpend: actual });
    expect(result.ok).toBe(true);
    const updated = list.find((i) => i.id === scheduled.id)!;
    expect(updated).toMatchObject({ executionStatus: 'Executed', finance: { status: 'Closed', actualSpend: actual } });
    const after = overviewMetrics(ds, list, f);
    expect(after.remainingBudget - before.remainingBudget).toBe(1500);
    expect(after.executedInvestment - before.executedInvestment).toBe(actual);
  });

  it('warns (but allows) overspend against approval', () => {
    const r = applyFinance(ds.initiatives, scheduled.id, { actualSpend: scheduled.approvedInvestment + 1000 }).result;
    expect(r.ok).toBe(true);
    expect(r.warnings.length).toBeGreaterThan(0);
  });
});

describe('safe maths', () => {
  it('never produces NaN or Infinity', () => {
    expect(safeRatio(5, 0)).toBeNull();
    expect(safeRatio(Number.NaN, 5)).toBeNull();
    expect(safeRatio(5, 10)).toBe(0.5);
  });

  it('returns null coverage when there is no target in scope', () => {
    const noTargets = { ...ds, targets: [] };
    expect(pipelineCell(noTargets, ds.initiatives, ALL).coverage).toBeNull();
  });
});
