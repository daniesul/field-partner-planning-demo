/**
 * Data model for the Global Field & Partner Marketing planning framework.
 *
 * The shape mirrors the original planning workbook:
 *  - "Global Initiative Entry"          -> Initiative
 *  - "Budget Data" (region x type x Q)  -> BudgetAllocation
 *  - "Investment to Pipeline Planning"  -> RegionalTarget
 *  - Finance tracker / PO columns       -> FinanceRecord (on each Initiative)
 *
 * All records in this demo are synthetic.
 */

export type Region = 'NA' | 'EMEA' | 'APJ';
export type Quarter = 'Q1' | 'Q2' | 'Q3' | 'Q4';

export type BudgetSource =
  | 'Regional Marketing'
  | 'Strategic Partner Funding'
  | 'AWS MDF'
  | 'Corporate Marketing'
  | 'Partner Co-Investment';

export type InitiativeCategory =
  | 'Trade Show'
  | 'Executive Event'
  | 'ABM Campaign'
  | 'Partner Program'
  | 'Webinar'
  | 'Roadshow'
  | 'Workshop'
  | 'Digital Campaign'
  | 'Other';

export type Solution = 'Security' | 'Observability' | 'Platform';
export type Segment = 'Commercial' | 'Enterprise' | 'Cross-Segment';
export type Objective = 'New Logo' | 'Customer Expansion' | 'Partner Growth';
export type Tier = 'P1' | 'P2' | 'P3';

/** Governance status — where the investment request sits in the approval process. */
export type ApprovalStatus = 'Draft' | 'Submitted' | 'Under Review' | 'Approved' | 'Rejected';

/** Delivery status — only meaningful once a request is approved. */
export type ExecutionStatus = 'Not Started' | 'Scheduled' | 'In Progress' | 'Executed' | 'Cancelled';

export type FinanceStatus = 'Not Submitted' | 'Submitted' | 'PO Issued' | 'Invoiced' | 'Closed';

/** One slice of an initiative's funding. Shares across an initiative sum to exactly 1. */
export interface FundingSplit {
  source: BudgetSource;
  share: number;
}

export interface FinanceRecord {
  status: FinanceStatus;
  poNumber: string | null;
  /** Financial commitment raised with finance (purchase order). */
  poAmount: number | null;
  /** Final reconciled spend. Only set once the initiative is executed and invoiced. */
  actualSpend: number | null;
}

/** Projected outcomes captured at request time. */
export interface ExpectedOutcomes {
  engagements: number;
  mqls: number;
  /** Net-new sourced pipeline. Never combined with influenced or deal-reg values. */
  newPipeline: number;
  influencedPipeline: number;
  dealRegistrations: number;
  dealRegValue: number;
}

/** Actual results, populated after execution. */
export interface ActualOutcomes {
  engagements: number | null;
  mqls: number | null;
  newPipeline: number | null;
  influencedPipeline: number | null;
  dealRegistrations: number | null;
  dealRegValue: number | null;
}

export interface Initiative {
  id: string;
  name: string;
  description: string;
  rationale: string;
  audience: string;
  approvalStatus: ApprovalStatus;
  executionStatus: ExecutionStatus;
  category: InitiativeCategory;
  startDate: string; // ISO yyyy-mm-dd
  quarter: Quarter;
  tier: Tier;
  solution: Solution;
  objective: Objective;
  segment: Segment;
  region: Region;
  subregion: string;
  owner: string;
  partner: string | null;
  funding: FundingSplit[];
  requestedInvestment: number;
  /** 0 unless approvalStatus === 'Approved'. */
  approvedInvestment: number;
  finance: FinanceRecord;
  expected: ExpectedOutcomes;
  actual: ActualOutcomes;
}

export interface BudgetAllocation {
  region: Region;
  source: BudgetSource;
  quarter: Quarter;
  amount: number;
}

export interface RegionalTarget {
  region: Region;
  quarter: Quarter;
  mqlTarget: number;
  pipelineTarget: number;
}

export interface Dataset {
  fiscalYear: string;
  /** "Today" for the demo — drives what counts as executed vs. upcoming. */
  asOf: string;
  /** Initiatives used as guided examples in the UI. */
  featured: {
    reconciliationExampleId: string;
    pipelineExampleId: string;
  };
  initiatives: Initiative[];
  budgets: BudgetAllocation[];
  targets: RegionalTarget[];
}

export interface Filters {
  quarter: Quarter | 'All';
  region: Region | 'All';
  source: BudgetSource | 'All';
  category: InitiativeCategory | 'All';
  solution: Solution | 'All';
}

export const REGIONS: Region[] = ['NA', 'EMEA', 'APJ'];
export const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
export const BUDGET_SOURCES: BudgetSource[] = [
  'Regional Marketing',
  'Strategic Partner Funding',
  'AWS MDF',
  'Corporate Marketing',
  'Partner Co-Investment',
];
export const CATEGORIES: InitiativeCategory[] = [
  'Trade Show',
  'Executive Event',
  'ABM Campaign',
  'Partner Program',
  'Webinar',
  'Roadshow',
  'Workshop',
  'Digital Campaign',
  'Other',
];
export const SOLUTIONS: Solution[] = ['Security', 'Observability', 'Platform'];

export const REGION_LABEL: Record<Region, string> = {
  NA: 'North America',
  EMEA: 'EMEA',
  APJ: 'APJ',
};

export const EMPTY_FILTERS: Filters = {
  quarter: 'All',
  region: 'All',
  source: 'All',
  category: 'All',
  solution: 'All',
};
