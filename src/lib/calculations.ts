/**
 * Calculation engine. Every number on every screen is derived here from the same
 * initiative records — no view keeps its own totals.
 *
 * SPEND DEFINITIONS (one initiative never counts twice in the same measure)
 * ─────────────────────────────────────────────────────────────────────────
 *  Proposed   requestedInvestment of requests still in Draft / Submitted / Under Review.
 *             Shown as "in planning"; never draws down budget.
 *  Approved   approvedInvestment of Approved requests. Rejected requests are always 0.
 *  Committed  PO amount raised with finance (status PO Issued / Invoiced / Closed).
 *  Actual     Final reconciled spend, recorded after execution.
 *  Consumed   What an approved initiative draws from budget right now — the most
 *             mature figure available: Actual → else Committed (PO) → else Approved.
 *             Cancelled initiatives without an actual consume 0.
 *  Remaining  Budget − Consumed.
 *  Variance   Approved − Actual (positive = under-spend released back to the pool).
 *
 * MULTI-SOURCE FUNDING
 *  An initiative's funding shares sum to 1. Dollar amounts are split across sources
 *  with integer rounding and the remainder assigned to the largest share, so the
 *  per-source pieces always add back to the whole (no double counting).
 *
 * PIPELINE DEFINITIONS
 *  Forecast new pipeline = expected new pipeline of Approved, non-cancelled initiatives.
 *  Proposed pipeline     = expected new pipeline of pending requests (not yet committed).
 *  Influenced pipeline and partner deal-registration value are reported separately and
 *  are never added to new pipeline.
 */
import type {
  ApprovalStatus,
  BudgetSource,
  Dataset,
  ExecutionStatus,
  FinanceStatus,
  Filters,
  Initiative,
  InitiativeCategory,
  Quarter,
  Region,
} from '../types/models';
import { BUDGET_SOURCES, CATEGORIES, QUARTERS, REGIONS } from '../types/models';

// ─────────────────────────────────────────────────────────── status helpers

export const PENDING_STATUSES: ApprovalStatus[] = ['Draft', 'Submitted', 'Under Review'];

export const isPending = (i: Initiative) => PENDING_STATUSES.includes(i.approvalStatus);
export const isApproved = (i: Initiative) => i.approvalStatus === 'Approved';
/** Approved and still going ahead — the basis for committed forecasts. */
export const isLive = (i: Initiative) => isApproved(i) && i.executionStatus !== 'Cancelled';

const COMMITTED_FINANCE: FinanceStatus[] = ['PO Issued', 'Invoiced', 'Closed'];

/** Workflow stage shown in the governance pipeline: Draft → … → Executed. */
export type WorkflowStage = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected' | 'Scheduled' | 'Executed';
export function workflowStage(i: Initiative): WorkflowStage {
  if (i.approvalStatus !== 'Approved') return i.approvalStatus;
  if (i.executionStatus === 'Executed') return 'Executed';
  if (i.executionStatus === 'Scheduled' || i.executionStatus === 'In Progress') return 'Scheduled';
  return 'Approved';
}

// ─────────────────────────────────────────────────────────── safe maths

/** Ratio that never returns NaN/Infinity — null when the denominator is not positive. */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return numerator / denominator;
}

export function pipelineToInvestment(i: Initiative): number | null {
  return safeRatio(i.expected.newPipeline, i.requestedInvestment);
}

/**
 * Split a whole-dollar amount across funding sources. Pieces always sum to `amount`.
 */
export function allocate(amount: number, funding: Initiative['funding']): Partial<Record<BudgetSource, number>> {
  const out: Partial<Record<BudgetSource, number>> = {};
  if (!funding.length || !amount) return out;
  const totalShare = funding.reduce((s, f) => s + f.share, 0);
  let assigned = 0;
  let largest = funding[0];
  for (const f of funding) {
    if (f.share > largest.share) largest = f;
    const piece = Math.round((amount * f.share) / totalShare);
    out[f.source] = (out[f.source] ?? 0) + piece;
    assigned += piece;
  }
  out[largest.source] = (out[largest.source] ?? 0) + (amount - assigned);
  return out;
}

/** Portion of `amount` attributable to the selected source filter. */
function attributed(amount: number, i: Initiative, source: Filters['source']): number {
  if (source === 'All') return amount;
  return allocate(amount, i.funding)[source] ?? 0;
}

/** Share used for non-dollar measures (MQLs etc.) when a source filter is active. */
function shareOf(i: Initiative, source: Filters['source']): number {
  if (source === 'All') return 1;
  const total = i.funding.reduce((s, f) => s + f.share, 0);
  return (i.funding.find((f) => f.source === source)?.share ?? 0) / (total || 1);
}

// ─────────────────────────────────────────────────────────── filters

export function matchesFilters(i: Initiative, f: Filters): boolean {
  if (f.quarter !== 'All' && i.quarter !== f.quarter) return false;
  if (f.region !== 'All' && i.region !== f.region) return false;
  if (f.category !== 'All' && i.category !== f.category) return false;
  if (f.solution !== 'All' && i.solution !== f.solution) return false;
  if (f.source !== 'All' && !i.funding.some((s) => s.source === f.source)) return false;
  return true;
}

export function filterInitiatives(list: Initiative[], f: Filters): Initiative[] {
  return list.filter((i) => matchesFilters(i, f));
}

export function searchInitiatives(list: Initiative[], query: string): Initiative[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter((i) =>
    [i.id, i.name, i.description, i.owner, i.partner ?? '', i.subregion, i.category, i.region]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

// ─────────────────────────────────────────────────────────── spend

export interface SpendBreakdown {
  proposed: number;
  approved: number;
  committed: number;
  actual: number;
  consumed: number;
  /** Approved − Actual on reconciled initiatives only. */
  variance: number;
}

export const ZERO_SPEND: SpendBreakdown = { proposed: 0, approved: 0, committed: 0, actual: 0, consumed: 0, variance: 0 };

export function spendOf(i: Initiative): SpendBreakdown {
  if (i.approvalStatus === 'Rejected') return { ...ZERO_SPEND };
  if (isPending(i)) return { ...ZERO_SPEND, proposed: i.requestedInvestment };
  const approved = i.approvedInvestment;
  const committed = i.finance.poAmount !== null && COMMITTED_FINANCE.includes(i.finance.status) ? i.finance.poAmount : 0;
  const actual = i.finance.actualSpend ?? 0;
  let consumed: number;
  if (i.finance.actualSpend !== null) consumed = i.finance.actualSpend;
  else if (i.executionStatus === 'Cancelled') consumed = 0;
  else if (committed > 0) consumed = committed;
  else consumed = approved;
  const variance = i.finance.actualSpend !== null ? approved - i.finance.actualSpend : 0;
  return { proposed: 0, approved, committed, actual, consumed, variance };
}

export function sumSpend(list: Initiative[], source: Filters['source'] = 'All'): SpendBreakdown {
  const t = { ...ZERO_SPEND };
  for (const i of list) {
    const s = spendOf(i);
    t.proposed += attributed(s.proposed, i, source);
    t.approved += attributed(s.approved, i, source);
    t.committed += attributed(s.committed, i, source);
    t.actual += attributed(s.actual, i, source);
    t.consumed += attributed(s.consumed, i, source);
    t.variance += attributed(s.variance, i, source);
  }
  return t;
}

export function budgetTotal(ds: Pick<Dataset, 'budgets'>, f: Pick<Filters, 'region' | 'quarter' | 'source'>): number {
  return ds.budgets
    .filter(
      (b) =>
        (f.region === 'All' || b.region === f.region) &&
        (f.quarter === 'All' || b.quarter === f.quarter) &&
        (f.source === 'All' || b.source === f.source),
    )
    .reduce((s, b) => s + b.amount, 0);
}

export interface BudgetRow extends SpendBreakdown {
  key: string;
  /** null when budgets aren't planned at this grain (e.g. by initiative category). */
  budget: number | null;
  remaining: number | null;
  /** Remaining if every pending request were approved at its requested amount. */
  remainingAfterProposed: number | null;
  utilisation: number | null;
}

function toRow(key: string, spend: SpendBreakdown, budget: number | null): BudgetRow {
  const remaining = budget === null ? null : budget - spend.consumed;
  return {
    key,
    ...spend,
    budget,
    remaining,
    remainingAfterProposed: remaining === null ? null : remaining - spend.proposed,
    utilisation: budget === null ? null : safeRatio(spend.consumed, budget),
  };
}

export type BudgetDimension = 'region' | 'source' | 'quarter' | 'category';

/**
 * Budget vs. spend grouped by a dimension. By source, each initiative contributes
 * only its funding share — so the source rows add up to the overall total.
 */
export function budgetBreakdown(ds: Dataset, list: Initiative[], f: Filters, by: BudgetDimension): BudgetRow[] {
  const scoped = filterInitiatives(list, f);
  if (by === 'source') {
    const sources = f.source === 'All' ? BUDGET_SOURCES : [f.source];
    return sources.map((src) =>
      toRow(src, sumSpend(scoped.filter((i) => i.funding.some((x) => x.source === src)), src), budgetTotal(ds, { ...f, source: src })),
    );
  }
  if (by === 'region') {
    const regions = f.region === 'All' ? REGIONS : [f.region];
    return regions.map((r) => toRow(r, sumSpend(scoped.filter((i) => i.region === r), f.source), budgetTotal(ds, { ...f, region: r })));
  }
  if (by === 'quarter') {
    const qs = f.quarter === 'All' ? QUARTERS : [f.quarter];
    return qs.map((q) => toRow(q, sumSpend(scoped.filter((i) => i.quarter === q), f.source), budgetTotal(ds, { ...f, quarter: q })));
  }
  const cats = f.category === 'All' ? CATEGORIES : [f.category];
  return cats
    .map((c) => toRow(c, sumSpend(scoped.filter((i) => i.category === c), f.source), null))
    .filter((r) => r.proposed + r.approved + r.actual > 0);
}

// ─────────────────────────────────────────────────────────── pipeline

export interface PipelineCell {
  region: Region | 'All';
  quarter: Quarter | 'All';
  mqlTarget: number;
  mqlForecast: number;
  mqlProposed: number;
  mqlCoverage: number | null;
  pipelineTarget: number;
  approvedPipeline: number;
  proposedPipeline: number;
  coverage: number | null;
  coverageWithProposed: number | null;
  /** max(target − approved forecast, 0) */
  gap: number;
  /** Separate measures — never added to new pipeline. */
  influencedPipeline: number;
  dealRegistrations: number;
  dealRegValue: number;
  /** Sourced pipeline actually created by executed initiatives. */
  actualPipeline: number;
  approvedInvestment: number;
  proposedInvestment: number;
}

export function pipelineCell(ds: Dataset, list: Initiative[], f: Filters): PipelineCell {
  const scoped = filterInitiatives(list, f);
  const targets = ds.targets.filter(
    (t) => (f.region === 'All' || t.region === f.region) && (f.quarter === 'All' || t.quarter === f.quarter),
  );
  const mqlTarget = targets.reduce((s, t) => s + t.mqlTarget, 0);
  const pipelineTarget = targets.reduce((s, t) => s + t.pipelineTarget, 0);
  let mqlForecast = 0;
  let mqlProposed = 0;
  let approvedPipeline = 0;
  let proposedPipeline = 0;
  let influenced = 0;
  let dealRegs = 0;
  let dealRegValue = 0;
  let actualPipeline = 0;
  for (const i of scoped) {
    const sh = shareOf(i, f.source);
    if (isLive(i)) {
      mqlForecast += i.expected.mqls * sh;
      approvedPipeline += attributed(i.expected.newPipeline, i, f.source);
      influenced += attributed(i.expected.influencedPipeline, i, f.source);
      dealRegs += i.expected.dealRegistrations * sh;
      dealRegValue += attributed(i.expected.dealRegValue, i, f.source);
      if (i.actual.newPipeline !== null) actualPipeline += attributed(i.actual.newPipeline, i, f.source);
    } else if (isPending(i)) {
      mqlProposed += i.expected.mqls * sh;
      proposedPipeline += attributed(i.expected.newPipeline, i, f.source);
    }
  }
  const spend = sumSpend(scoped, f.source);
  return {
    region: f.region,
    quarter: f.quarter,
    mqlTarget,
    mqlForecast: Math.round(mqlForecast),
    mqlProposed: Math.round(mqlProposed),
    mqlCoverage: safeRatio(mqlForecast, mqlTarget),
    pipelineTarget,
    approvedPipeline,
    proposedPipeline,
    coverage: safeRatio(approvedPipeline, pipelineTarget),
    coverageWithProposed: safeRatio(approvedPipeline + proposedPipeline, pipelineTarget),
    gap: Math.max(pipelineTarget - approvedPipeline, 0),
    influencedPipeline: influenced,
    dealRegistrations: Math.round(dealRegs),
    dealRegValue,
    actualPipeline,
    approvedInvestment: spend.approved,
    proposedInvestment: spend.proposed,
  };
}

/** Region × quarter grid for the planning matrix. */
export function pipelineMatrix(ds: Dataset, list: Initiative[], f: Filters): PipelineCell[] {
  const out: PipelineCell[] = [];
  for (const r of REGIONS) for (const q of QUARTERS) out.push(pipelineCell(ds, list, { ...f, region: r, quarter: q }));
  return out;
}

// ─────────────────────────────────────────────────────────── overview

export interface OverviewMetrics {
  totalInitiatives: number;
  pendingApproval: number;
  budget: number;
  approvedInvestment: number;
  executedInvestment: number;
  committedInvestment: number;
  proposedInvestment: number;
  remainingBudget: number;
  forecastMqls: number;
  forecastPipeline: number;
  pipelineTarget: number;
  coverage: number | null;
  gap: number;
}

export function overviewMetrics(ds: Dataset, list: Initiative[], f: Filters): OverviewMetrics {
  const scoped = filterInitiatives(list, f);
  const spend = sumSpend(scoped, f.source);
  const budget = budgetTotal(ds, f);
  const p = pipelineCell(ds, list, f);
  return {
    totalInitiatives: scoped.length,
    pendingApproval: scoped.filter((i) => i.approvalStatus === 'Submitted' || i.approvalStatus === 'Under Review').length,
    budget,
    approvedInvestment: spend.approved,
    executedInvestment: spend.actual,
    committedInvestment: spend.committed,
    proposedInvestment: spend.proposed,
    remainingBudget: budget - spend.consumed,
    forecastMqls: p.mqlForecast,
    forecastPipeline: p.approvedPipeline,
    pipelineTarget: p.pipelineTarget,
    coverage: p.coverage,
    gap: p.gap,
  };
}

/** Investment matrix: category × region (approved + proposed separately). */
export function investmentByCategoryRegion(list: Initiative[], f: Filters) {
  const scoped = filterInitiatives(list, f);
  return CATEGORIES.map((c) => {
    const row: Record<string, number | string> = { category: c };
    let total = 0;
    for (const r of REGIONS) {
      const s = sumSpend(scoped.filter((i) => i.category === c && i.region === r), f.source);
      row[r] = s.approved;
      total += s.approved;
    }
    row.total = total;
    row.proposed = sumSpend(scoped.filter((i) => i.category === c), f.source).proposed;
    return row as { category: InitiativeCategory; NA: number; EMEA: number; APJ: number; total: number; proposed: number };
  }).filter((r) => r.total + r.proposed > 0);
}

// ─────────────────────────────────────────────────────────── workflow

export type WorkflowAction = 'submit' | 'review' | 'approve' | 'reject' | 'reopen';

export const ALLOWED_ACTIONS: Record<ApprovalStatus, WorkflowAction[]> = {
  Draft: ['submit'],
  Submitted: ['review', 'approve', 'reject'],
  'Under Review': ['approve', 'reject'],
  Approved: [],
  Rejected: ['reopen'],
};

export class WorkflowError extends Error {}

/**
 * Apply a governance decision. Returns a new array; the input is not mutated.
 * Approval commits the requested amount and schedules execution; rejection removes
 * the request from approved investment and committed pipeline forecasts.
 */
export function applyWorkflow(list: Initiative[], id: string, action: WorkflowAction): Initiative[] {
  const target = list.find((i) => i.id === id);
  if (!target) throw new WorkflowError(`Unknown initiative ${id}`);
  if (!ALLOWED_ACTIONS[target.approvalStatus].includes(action)) {
    throw new WorkflowError(`Cannot ${action} an initiative that is ${target.approvalStatus}`);
  }
  return list.map((i) => {
    if (i.id !== id) return i;
    switch (action) {
      case 'submit':
        return { ...i, approvalStatus: 'Submitted' as ApprovalStatus };
      case 'review':
        return { ...i, approvalStatus: 'Under Review' as ApprovalStatus };
      case 'approve':
        return {
          ...i,
          approvalStatus: 'Approved' as ApprovalStatus,
          executionStatus: 'Scheduled' as ExecutionStatus,
          approvedInvestment: i.requestedInvestment,
          finance: { status: 'Not Submitted', poNumber: null, poAmount: null, actualSpend: null },
        };
      case 'reject':
        return {
          ...i,
          approvalStatus: 'Rejected' as ApprovalStatus,
          executionStatus: 'Not Started' as ExecutionStatus,
          approvedInvestment: 0,
          finance: { status: 'Not Submitted', poNumber: null, poAmount: null, actualSpend: null },
        };
      case 'reopen':
        return { ...i, approvalStatus: 'Under Review' as ApprovalStatus };
    }
  });
}

// ─────────────────────────────────────────────────────────── finance updates

export interface FinancePatch {
  status?: FinanceStatus;
  poNumber?: string | null;
  poAmount?: number | null;
  actualSpend?: number | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const MAX_AMOUNT = 5_000_000;

export function validateFinance(i: Initiative, patch: FinancePatch): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const next = { ...i.finance, ...patch };
  if (!isApproved(i)) errors.push('Finance details can only be recorded on approved initiatives.');
  for (const [label, v] of [
    ['PO amount', next.poAmount],
    ['Actual spend', next.actualSpend],
  ] as const) {
    if (v === null) continue;
    if (!Number.isFinite(v)) errors.push(`${label} must be a number.`);
    else if (v < 0) errors.push(`${label} cannot be negative.`);
    else if (v > MAX_AMOUNT) errors.push(`${label} exceeds the $${MAX_AMOUNT.toLocaleString()} limit for a single initiative.`);
  }
  if (next.poAmount !== null && !next.poNumber?.trim()) errors.push('A PO amount needs a PO number.');
  if (next.poAmount !== null && next.poAmount > i.approvedInvestment) {
    warnings.push('PO exceeds the approved amount — re-approval required before committing.');
  }
  if (next.actualSpend !== null && next.actualSpend > i.approvedInvestment) {
    warnings.push(`Actual spend is over approved budget by $${(next.actualSpend - i.approvedInvestment).toLocaleString()}.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Record finance details. Recording an actual closes the loop: the initiative is marked
 * Executed and its finance record Closed, so remaining budget reflects actual spend.
 */
export function applyFinance(list: Initiative[], id: string, patch: FinancePatch): { list: Initiative[]; result: ValidationResult } {
  const target = list.find((i) => i.id === id);
  if (!target) return { list, result: { ok: false, errors: [`Unknown initiative ${id}`], warnings: [] } };
  const result = validateFinance(target, patch);
  if (!result.ok) return { list, result };
  const next = list.map((i) => {
    if (i.id !== id) return i;
    const finance = { ...i.finance, ...patch };
    if (finance.poAmount !== null && finance.status === 'Not Submitted') finance.status = 'PO Issued';
    let executionStatus = i.executionStatus;
    if (finance.actualSpend !== null) {
      finance.status = 'Closed';
      if (executionStatus !== 'Cancelled') executionStatus = 'Executed';
    }
    return { ...i, finance, executionStatus };
  });
  return { list: next, result };
}
