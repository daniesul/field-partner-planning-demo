/**
 * Synthetic data generator.
 *
 * Produces src/data/dataset.json — a fully fictional fiscal year of field & partner
 * marketing initiatives, budgets and pipeline targets. Deterministic (seeded), so the
 * demo always resets to the same known state.
 *
 *   npm run generate:data
 *
 * Nothing in here is derived from real company, customer, partner, employee or
 * financial records. Partner and event names are invented.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ApprovalStatus,
  BudgetAllocation,
  BudgetSource,
  Dataset,
  ExecutionStatus,
  FinanceStatus,
  FundingSplit,
  Initiative,
  InitiativeCategory,
  Objective,
  Quarter,
  Region,
  RegionalTarget,
  Segment,
  Solution,
  Tier,
} from '../src/types/models';

// ---------------------------------------------------------------- seeded RNG
let seed = Number(process.env.SEED ?? 999);
function rand(): number {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (lo: number, hi: number) => lo + rand() * (hi - lo);
const int = (lo: number, hi: number) => Math.floor(between(lo, hi + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

// ---------------------------------------------------------------- calendar
const FY = 'FY27';
const AS_OF = '2026-09-14'; // mid-Q3
const QUARTER_MONTHS: Record<Quarter, [number, number][]> = {
  // [year, month(1-12)] — fiscal year starts in February
  Q1: [[2026, 2], [2026, 3], [2026, 4]],
  Q2: [[2026, 5], [2026, 6], [2026, 7]],
  Q3: [[2026, 8], [2026, 9], [2026, 10]],
  Q4: [[2026, 11], [2026, 12], [2027, 1]],
};
function dateIn(q: Quarter): string {
  const [y, m] = pick(QUARTER_MONTHS[q]);
  const d = int(3, 26);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- reference lists
const SUBREGIONS: Record<Region, string[]> = {
  NA: ['US East', 'US Central', 'US West', 'Canada', 'US Public Sector'],
  EMEA: ['UK & Ireland', 'DACH', 'Nordics', 'France & Benelux', 'Middle East'],
  APJ: ['ANZ', 'Japan', 'Singapore & SEA', 'India'],
};
const CITIES: Record<Region, string[]> = {
  NA: ['New York', 'Chicago', 'Austin', 'San Francisco', 'Toronto', 'Atlanta', 'Boston', 'Denver', 'Washington, DC', 'Seattle'],
  EMEA: ['London', 'Munich', 'Stockholm', 'Paris', 'Amsterdam', 'Dubai', 'Dublin', 'Frankfurt'],
  APJ: ['Sydney', 'Melbourne', 'Tokyo', 'Singapore', 'Bengaluru', 'Auckland'],
};
const OWNERS: Record<Region, string[]> = {
  NA: ['Dana Whitfield', 'Marcus Oyelaran', 'Priya Castellanos', 'Jordan Ames', 'Elena Brooks'],
  EMEA: ['Sofie Lindqvist', 'Tomás Reyes', 'Hannah Brandt', 'Olivier Marchetti'],
  APJ: ['Kenji Arata', 'Mei Tan', 'Rhys Callaghan', 'Ananya Rao'],
};
const PARTNERS: Record<Region, string[]> = {
  NA: ['Northbeam Systems', 'Ironwood Integration', 'Cobaltline Security', 'Vantage Ridge Partners', 'Bluepeak Cloud Services', 'Arclight MSSP'],
  EMEA: ['Kestrel Data Group', 'Halvorsen Digital', 'Meridian Edge', 'Tessellate Consulting'],
  APJ: ['Sakura Cloud Works', 'Southern Cross Integrators', 'Lionsgate Secure (SG)', 'Tessellate Consulting'],
};
const TRADE_SHOWS = ['Sentinel Security Expo', 'CloudScale Summit', 'Telemetry World', 'ZeroTrust Forum', 'Modern SOC Conference', 'Cloud Native Ops Live'];
const INDUSTRIES = ['Financial Services', 'Healthcare', 'Retail', 'Manufacturing', 'Public Sector', 'Technology', 'Media'];
const WEBINAR_TOPICS: Record<Solution, string[]> = {
  Security: ['Cloud SIEM in 30 Minutes', 'Detecting Threats in Multi-Cloud', 'From Alert Fatigue to Automation', 'Securing Kubernetes Workloads'],
  Observability: ['Reducing MTTR with Unified Logs', 'Observability for Serverless', 'Cost-Aware Telemetry Pipelines', 'SLOs That Engineers Trust'],
  Platform: ['Consolidating Logs, Metrics & Traces', 'One Platform for SecOps & DevOps'],
};

interface Template {
  category: InitiativeCategory;
  cost: [number, number];
  /** pipeline-to-investment multiple */
  ratio: [number, number];
  /** MQLs per $1k */
  mqlPerK: [number, number];
  engagementsPerMql: [number, number];
  name: (r: Region, s: Solution, partner: string) => string;
  description: (r: Region, s: Solution, partner: string) => string;
  audience: (s: Solution, seg: Segment) => string;
  usesPartner: boolean;
  weight: number;
}

const audienceBase = (s: Solution) =>
  s === 'Security' ? 'CISOs, security architects and SOC leaders' : s === 'Observability' ? 'VPs of Engineering, SRE and platform teams' : 'Security and engineering leadership';

const TEMPLATES: Template[] = [
  {
    category: 'Trade Show', cost: [35000, 160000], ratio: [7, 14], mqlPerK: [1.4, 2.6], engagementsPerMql: [3, 5], usesPartner: false, weight: 2,
    name: (r) => `${pick(TRADE_SHOWS)} — ${pick(CITIES[r])}`,
    description: (_r, s) => `Sponsored booth and speaking session at a regional industry trade show, focused on ${s.toLowerCase()} use cases.`,
    audience: (s, seg) => `${audienceBase(s)} at ${seg === 'Enterprise' ? 'enterprise' : seg === 'Commercial' ? 'mid-market' : 'mid-market and enterprise'} accounts`,
  } as Template,
  {
    category: 'Executive Event', cost: [12000, 35000], ratio: [16, 34], mqlPerK: [0.4, 0.9], engagementsPerMql: [1.5, 2.5], usesPartner: false, weight: 2,
    name: (r, s) => `Executive ${s === 'Observability' ? 'Engineering Leaders' : 'CISO'} Dinner — ${pick(CITIES[r])}`,
    description: (_r, s) => `Invite-only dinner for ${s === 'Observability' ? 'engineering executives' : 'security executives'} at named target accounts, hosted with a customer speaker.`,
    audience: (s) => `C-level and VP ${s === 'Observability' ? 'engineering' : 'security'} executives at named target accounts`,
  } as Template,
  {
    category: 'ABM Campaign', cost: [18000, 60000], ratio: [12, 24], mqlPerK: [0.8, 1.6], engagementsPerMql: [4, 8], usesPartner: false, weight: 2,
    name: (_r, s) => `${pick(INDUSTRIES)} ABM Program — ${s}`,
    description: () => 'One-to-few account-based program combining intent data, personalised outreach, direct mail and SDR plays.',
    audience: (s, seg) => `Buying committees at ${seg === 'Commercial' ? 'high-fit commercial' : 'tier-1 enterprise'} target accounts (${audienceBase(s)})`,
  } as Template,
  {
    category: 'Partner Program', cost: [8000, 55000], ratio: [8, 18], mqlPerK: [0.9, 1.8], engagementsPerMql: [3, 6], usesPartner: true, weight: 3,
    name: (_r, _s, p) => pick([`Partner Sales Kickoff — ${p}`, `Partner Co-Marketing Activation — ${p}`, `Joint Demand Program — ${p}`]),
    description: (_r, s, p) => `Joint go-to-market activation with ${p} to build ${s.toLowerCase()} pipeline through the partner's sellers and customer base.`,
    audience: (s) => `Partner sellers and their installed-base customers (${audienceBase(s)})`,
  } as Template,
  {
    category: 'Webinar', cost: [3000, 12000], ratio: [6, 15], mqlPerK: [5, 10], engagementsPerMql: [2.5, 4], usesPartner: false, weight: 2,
    name: (_r, s) => `${s === 'Observability' ? 'Observability' : 'Cloud Security'} Webinar: ${pick(WEBINAR_TOPICS[s])}`,
    description: (r) => `Live technical webinar with on-demand follow-up, localised for ${r === 'NA' ? 'North America' : r}.`,
    audience: (s) => `Practitioners and technical evaluators (${audienceBase(s)})`,
  } as Template,
  {
    category: 'Roadshow', cost: [30000, 90000], ratio: [9, 16], mqlPerK: [1.2, 2.2], engagementsPerMql: [2.5, 4], usesPartner: false, weight: 1,
    name: (r) => {
      const a = pick(CITIES[r]);
      const b = pick(CITIES[r].filter((c) => c !== a));
      return `Regional Customer Roadshow — ${a} & ${b}`;
    },
    description: (_r, s) => `Multi-city half-day roadshow with customer stories, hands-on demos and ${s.toLowerCase()} roadmap briefings.`,
    audience: (s) => `Customers and late-stage prospects (${audienceBase(s)})`,
  } as Template,
  {
    category: 'Workshop', cost: [5000, 22000], ratio: [8, 18], mqlPerK: [1.2, 2.4], engagementsPerMql: [1.5, 3], usesPartner: true, weight: 2,
    name: (r, s, p) => chance(0.5) ? `Partner Enablement Workshop — ${p}` : `Hands-on ${s} Workshop — ${pick(CITIES[r])}`,
    description: (_r, s) => `Technical, hands-on workshop to build ${s.toLowerCase()} skills and generate qualified evaluations.`,
    audience: (s) => `Technical practitioners and partner SEs (${audienceBase(s)})`,
  } as Template,
  {
    category: 'Digital Campaign', cost: [15000, 50000], ratio: [7, 15], mqlPerK: [2, 4], engagementsPerMql: [5, 10], usesPartner: false, weight: 2,
    name: (_r, s) => pick([`Customer Expansion Campaign — ${s}`, `Cloud Migration Nurture — ${s}`, `${s} Competitive Displacement Campaign`]),
    description: () => 'Always-on paid and owned digital program with content syndication, retargeting and nurture streams.',
    audience: (s, seg) => `${seg === 'Commercial' ? 'Commercial' : 'Enterprise'} accounts in market (${audienceBase(s)})`,
  } as Template,
  {
    category: 'Other', cost: [8000, 40000], ratio: [5, 12], mqlPerK: [0.5, 1.2], engagementsPerMql: [2, 4], usesPartner: false, weight: 1,
    name: (r) => pick([`Customer Advisory Board — ${r === 'NA' ? 'North America' : r}`, 'Field Sales Play Kit', 'Regional Cybersecurity Summit Sponsorship']),
    description: () => 'Supporting field program that enables sellers and strengthens customer relationships.',
    audience: () => 'Strategic customers and field sellers',
  } as Template,
];

function pickTemplate(): Template {
  const total = TEMPLATES.reduce((s, t) => s + t.weight, 0);
  let x = rand() * total;
  for (const t of TEMPLATES) {
    x -= t.weight;
    if (x <= 0) return t;
  }
  return TEMPLATES[0];
}

function fundingFor(cat: InitiativeCategory, tier: Tier, partner: string | null): FundingSplit[] {
  if (cat === 'Partner Program') {
    return pick<FundingSplit[]>([
      [{ source: 'Strategic Partner Funding', share: 1 }],
      [{ source: 'AWS MDF', share: 0.7 }, { source: 'Partner Co-Investment', share: 0.3 }],
      [{ source: 'Strategic Partner Funding', share: 0.5 }, { source: 'Partner Co-Investment', share: 0.5 }],
    ]);
  }
  if (cat === 'Trade Show') {
    return tier === 'P1' ? [{ source: 'Corporate Marketing', share: 1 }] : pick<FundingSplit[]>([
      [{ source: 'Regional Marketing', share: 1 }],
      [{ source: 'Regional Marketing', share: 0.5 }, { source: 'AWS MDF', share: 0.5 }],
    ]);
  }
  if (cat === 'Workshop' && partner) return [{ source: 'Strategic Partner Funding', share: 1 }];
  if (cat === 'Webinar' || cat === 'Digital Campaign') {
    return pick<FundingSplit[]>([[{ source: 'Regional Marketing', share: 1 }], [{ source: 'AWS MDF', share: 1 }]]);
  }
  if (cat === 'Roadshow') return [{ source: 'Regional Marketing', share: 0.6 }, { source: 'AWS MDF', share: 0.4 }];
  if (cat === 'Other' && chance(0.5)) return [{ source: 'Corporate Marketing', share: 1 }];
  return [{ source: 'Regional Marketing', share: 1 }];
}

const RATIONALES: Record<Objective, string[]> = {
  'New Logo': [
    'Target account list shows low awareness in this territory; sales leadership requested top-of-funnel coverage for net-new logos.',
    'Supports the regional new-logo pipeline gap identified in quarterly planning.',
  ],
  'Customer Expansion': [
    'Installed-base accounts with expansion signals; designed to accelerate cross-sell into the second product line.',
    'Account managers requested a program to convert usage growth into expansion opportunities.',
  ],
  'Partner Growth': [
    'Partner has strong reach into target accounts but low deal registration velocity; investment tied to registration commitments.',
    'Builds partner-sourced pipeline and seller enablement in a priority territory.',
  ],
};

// ---------------------------------------------------------------- build initiatives
const REGION_COUNTS: Record<Region, number> = { NA: 56, EMEA: 38, APJ: 32 };
const QUARTERS: Quarter[] = ['Q1', 'Q2', 'Q3', 'Q4'];
const seq: Record<Quarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
const nextId = (q: Quarter) => `${FY}-${q}-${String(++seq[q]).padStart(4, '0')}`;

function statusesFor(q: Quarter, start: string): { approval: ApprovalStatus; exec: ExecutionStatus } {
  const past = start < AS_OF;
  if (q === 'Q1' || q === 'Q2') {
    if (chance(0.08)) return { approval: 'Rejected', exec: 'Not Started' };
    if (chance(0.03)) return { approval: 'Approved', exec: 'Cancelled' };
    return { approval: 'Approved', exec: 'Executed' };
  }
  if (q === 'Q3') {
    if (past) {
      if (chance(0.07)) return { approval: 'Rejected', exec: 'Not Started' };
      return { approval: 'Approved', exec: chance(0.75) ? 'Executed' : 'In Progress' };
    }
    const x = rand();
    if (x < 0.62) return { approval: 'Approved', exec: 'Scheduled' };
    if (x < 0.8) return { approval: 'Under Review', exec: 'Not Started' };
    if (x < 0.94) return { approval: 'Submitted', exec: 'Not Started' };
    return { approval: 'Rejected', exec: 'Not Started' };
  }
  const x = rand();
  if (x < 0.52) return { approval: 'Approved', exec: 'Scheduled' };
  if (x < 0.67) return { approval: 'Under Review', exec: 'Not Started' };
  if (x < 0.82) return { approval: 'Submitted', exec: 'Not Started' };
  if (x < 0.93) return { approval: 'Draft', exec: 'Not Started' };
  return { approval: 'Rejected', exec: 'Not Started' };
}

let poSeq = 48210;

function makeInitiative(region: Region, q: Quarter): Initiative {
  const t = pickTemplate();
  const solution: Solution = pick<Solution>(['Security', 'Security', 'Observability', 'Observability', 'Platform']);
  const segment: Segment = pick<Segment>(['Commercial', 'Enterprise', 'Enterprise', 'Cross-Segment']);
  const partner = t.usesPartner || (t.category === 'Webinar' && chance(0.25)) ? pick(PARTNERS[region]) : null;
  const objective: Objective = partner ? 'Partner Growth' : pick<Objective>(['New Logo', 'New Logo', 'Customer Expansion']);
  const tier: Tier = t.cost[1] > 80000 && chance(0.5) ? 'P1' : pick<Tier>(['P1', 'P2', 'P2', 'P3']);
  const regionScale = region === 'NA' ? 1 : region === 'EMEA' ? 0.8 : 0.7;
  const requested = roundTo(between(t.cost[0], t.cost[1]) * regionScale, 500);
  const start = dateIn(q);
  const { approval, exec } = statusesFor(q, start);

  const mqls = Math.max(3, Math.round((requested / 1000) * between(...t.mqlPerK)));
  const newPipeline = roundTo(requested * between(...t.ratio), 5000);
  const influenced = roundTo(newPipeline * between(1.2, 2.6), 5000);
  const dealRegs = partner ? int(3, 18) : 0;
  const dealRegValue = partner ? roundTo(dealRegs * between(60000, 140000), 5000) : 0;
  const engagements = Math.round(mqls * between(...t.engagementsPerMql));

  const approved = approval === 'Approved' ? (chance(0.18) ? roundTo(requested * between(0.82, 0.95), 500) : requested) : 0;

  let financeStatus: FinanceStatus = 'Not Submitted';
  let poNumber: string | null = null;
  let poAmount: number | null = null;
  let actualSpend: number | null = null;
  if (approval === 'Approved') {
    if (exec === 'Executed') {
      financeStatus = q === 'Q3' && chance(0.5) ? 'Invoiced' : 'Closed';
      poNumber = `PO-${++poSeq}`;
      poAmount = approved;
      actualSpend = roundTo(approved * between(0.8, 1.06), 100);
    } else if (exec === 'Cancelled') {
      financeStatus = 'Closed';
      poNumber = `PO-${++poSeq}`;
      poAmount = approved;
      actualSpend = roundTo(approved * between(0.05, 0.2), 100); // cancellation fees
    } else if (exec === 'In Progress') {
      financeStatus = 'PO Issued';
      poNumber = `PO-${++poSeq}`;
      poAmount = approved;
    } else {
      const x = rand();
      if (x < 0.55) {
        financeStatus = 'PO Issued';
        poNumber = `PO-${++poSeq}`;
        poAmount = approved;
      } else if (x < 0.8) financeStatus = 'Submitted';
    }
  }

  const executed = exec === 'Executed';
  const perf = between(0.55, 1.35);
  return {
    id: nextId(q),
    name: t.name(region, solution, partner ?? ''),
    description: t.description(region, solution, partner ?? ''),
    rationale: pick(RATIONALES[objective]),
    audience: t.audience(solution, segment),
    approvalStatus: approval,
    executionStatus: exec,
    category: t.category,
    startDate: start,
    quarter: q,
    tier,
    solution,
    objective,
    segment,
    region,
    subregion: pick(SUBREGIONS[region]),
    owner: pick(OWNERS[region]),
    partner,
    funding: fundingFor(t.category, tier, partner),
    requestedInvestment: requested,
    approvedInvestment: approved,
    finance: { status: financeStatus, poNumber, poAmount, actualSpend },
    expected: { engagements, mqls, newPipeline, influencedPipeline: influenced, dealRegistrations: dealRegs, dealRegValue },
    actual: executed
      ? {
          engagements: Math.round(engagements * between(0.7, 1.25)),
          mqls: Math.round(mqls * perf),
          newPipeline: roundTo(newPipeline * perf * between(0.85, 1.15), 5000),
          influencedPipeline: roundTo(influenced * between(0.7, 1.3), 5000),
          dealRegistrations: partner ? Math.round(dealRegs * between(0.5, 1.3)) : 0,
          dealRegValue: partner ? roundTo(dealRegValue * between(0.5, 1.3), 5000) : 0,
        }
      : { engagements: null, mqls: null, newPipeline: null, influencedPipeline: null, dealRegistrations: null, dealRegValue: null },
  };
}

const initiatives: Initiative[] = [];
for (const region of Object.keys(REGION_COUNTS) as Region[]) {
  for (let i = 0; i < REGION_COUNTS[region]; i++) {
    initiatives.push(makeInitiative(region, QUARTERS[i % 4]));
  }
}

// ---------------------------------------------------------------- featured examples
// 1) Reconciliation example: approved $25,000, executed for $21,000 -> $4,000 released.
const recon: Initiative = {
  ...makeInitiative('EMEA', 'Q2'),
  name: 'Executive CISO Dinner — London',
  description: 'Invite-only dinner for 18 security executives from named FTSE target accounts, with a customer CISO fireside chat.',
  rationale: 'UK enterprise new-logo coverage was below plan; sales leadership nominated 25 target accounts for executive engagement.',
  audience: 'CISOs and Deputy CISOs at named UK enterprise target accounts',
  category: 'Executive Event',
  approvalStatus: 'Approved',
  executionStatus: 'Executed',
  startDate: '2026-06-11',
  tier: 'P1',
  solution: 'Security',
  objective: 'New Logo',
  segment: 'Enterprise',
  subregion: 'UK & Ireland',
  owner: 'Sofie Lindqvist',
  partner: null,
  funding: [{ source: 'Regional Marketing', share: 1 }],
  requestedInvestment: 25000,
  approvedInvestment: 25000,
  finance: { status: 'Closed', poNumber: 'PO-47990', poAmount: 25000, actualSpend: 21000 },
  expected: { engagements: 22, mqls: 14, newPipeline: 650000, influencedPipeline: 1200000, dealRegistrations: 0, dealRegValue: 0 },
  actual: { engagements: 19, mqls: 12, newPipeline: 720000, influencedPipeline: 1350000, dealRegistrations: 0, dealRegValue: 0 },
};
initiatives.push(recon);

// 2) Pipeline example: proposed NA Q3 initiative forecasting $500K new pipeline.
const pipelineExample: Initiative = {
  ...makeInitiative('NA', 'Q3'),
  name: 'Partner Co-Marketing Activation — Northbeam Systems',
  description: 'Joint cloud-security accelerator with Northbeam: co-branded assessment offer, two partner-hosted workshops and a seller SPIFF.',
  rationale: 'North America Q3 new pipeline is forecast $1.8M short of target. Northbeam has committed 12 qualified deal registrations in exchange for co-funding.',
  audience: 'Northbeam enterprise customers running AWS workloads; security architects and CISOs',
  category: 'Partner Program',
  approvalStatus: 'Under Review',
  executionStatus: 'Not Started',
  startDate: '2026-10-06',
  tier: 'P1',
  solution: 'Security',
  objective: 'Partner Growth',
  segment: 'Enterprise',
  subregion: 'US East',
  owner: 'Dana Whitfield',
  partner: 'Northbeam Systems',
  funding: [{ source: 'AWS MDF', share: 0.7 }, { source: 'Partner Co-Investment', share: 0.3 }],
  requestedInvestment: 40000,
  approvedInvestment: 0,
  finance: { status: 'Not Submitted', poNumber: null, poAmount: null, actualSpend: null },
  expected: { engagements: 180, mqls: 45, newPipeline: 500000, influencedPipeline: 900000, dealRegistrations: 12, dealRegValue: 1440000 },
  actual: { engagements: null, mqls: null, newPipeline: null, influencedPipeline: null, dealRegistrations: null, dealRegValue: null },
};
initiatives.push(pipelineExample);

// ---------------------------------------------------------------- normalisation
// Random category mixes make some region-quarters lumpy. Normalise so every region has
// a believable quarterly investment envelope and pipeline plan, and so the guided
// example (NA Q3: $10M target, $8.2M approved forecast) is exact.
const FEATURED = new Set([recon, pipelineExample]);
const ENVELOPE: Record<Region, number> = { NA: 560000, EMEA: 320000, APJ: 210000 };
const SEASON: Record<Quarter, number> = { Q1: 0.85, Q2: 1.0, Q3: 1.05, Q4: 1.1 };
const PIPELINE_TARGET: Record<Region, Record<Quarter, number>> = {
  NA: { Q1: 7_200_000, Q2: 8_600_000, Q3: 10_000_000, Q4: 11_000_000 },
  EMEA: { Q1: 3_400_000, Q2: 3_800_000, Q3: 4_200_000, Q4: 4_600_000 },
  APJ: { Q1: 1_800_000, Q2: 2_100_000, Q3: 2_400_000, Q4: 2_700_000 },
};
const APPROVED_COVERAGE: Record<Region, Record<Quarter, number>> = {
  NA: { Q1: 0.97, Q2: 1.04, Q3: 0.82, Q4: 0.44 },
  EMEA: { Q1: 1.03, Q2: 0.94, Q3: 0.88, Q4: 0.55 },
  APJ: { Q1: 0.91, Q2: 1.06, Q3: 0.71, Q4: 0.41 },
};
/** Pending pipeline as a multiple of the remaining gap (>1 means approving everything over-covers). */
const PENDING_VS_GAP: Record<Region, Record<Quarter, number>> = {
  NA: { Q1: 1, Q2: 1, Q3: 1.0, Q4: 0.85 },
  EMEA: { Q1: 1, Q2: 1, Q3: 1.3, Q4: 0.7 },
  APJ: { Q1: 1, Q2: 1, Q3: 0.8, Q4: 1.15 },
};

function scaleInvestment(i: Initiative, k: number) {
  const wasFull = i.approvedInvestment === i.requestedInvestment;
  i.requestedInvestment = Math.max(1000, roundTo(i.requestedInvestment * k, 500));
  if (i.approvalStatus === 'Approved') {
    i.approvedInvestment = wasFull ? i.requestedInvestment : Math.min(i.requestedInvestment, roundTo(i.approvedInvestment * k, 500));
  }
  if (i.finance.poAmount !== null) i.finance.poAmount = i.approvedInvestment;
  if (i.finance.actualSpend !== null) i.finance.actualSpend = roundTo(i.finance.actualSpend * k, 100);
  i.expected.mqls = Math.max(3, Math.round(i.expected.mqls * k));
  i.expected.engagements = Math.max(i.expected.mqls, Math.round(i.expected.engagements * k));
  if (i.actual.mqls !== null) i.actual.mqls = Math.max(1, Math.round(i.actual.mqls * k));
  if (i.actual.engagements !== null) i.actual.engagements = Math.round(i.actual.engagements * k);
}

/** Scale a group's new pipeline to hit an exact total (rounded to $5k, remainder on the last record). */
function scalePipelineTo(group: Initiative[], total: number) {
  if (!group.length) return;
  const current = group.reduce((s, i) => s + i.expected.newPipeline, 0);
  const k = total / current;
  let running = 0;
  group.forEach((i, idx) => {
    const before = i.expected.newPipeline;
    const v = idx === group.length - 1 ? total - running : Math.max(5000, roundTo(before * k, 5000));
    const kk = v / before;
    i.expected.newPipeline = v;
    i.expected.influencedPipeline = roundTo(i.expected.influencedPipeline * kk, 5000);
    if (i.actual.newPipeline !== null) i.actual.newPipeline = roundTo(i.actual.newPipeline * kk, 5000);
    if (i.actual.influencedPipeline !== null) i.actual.influencedPipeline = roundTo(i.actual.influencedPipeline * kk, 5000);
    running += v;
  });
}

const isLive = (i: Initiative) => i.approvalStatus === 'Approved' && i.executionStatus !== 'Cancelled';
const isPending = (i: Initiative) => ['Draft', 'Submitted', 'Under Review'].includes(i.approvalStatus);

for (const region of ['NA', 'EMEA', 'APJ'] as Region[]) {
  for (const q of QUARTERS) {
    const cell = initiatives.filter((i) => i.region === region && i.quarter === q);
    const movable = cell.filter((i) => !FEATURED.has(i));
    const fixedReq = cell.filter((i) => FEATURED.has(i)).reduce((s, i) => s + i.requestedInvestment, 0);
    const req = movable.reduce((s, i) => s + i.requestedInvestment, 0);
    const k = (ENVELOPE[region] * SEASON[q] - fixedReq) / req;
    movable.forEach((i) => scaleInvestment(i, k));

    const target = PIPELINE_TARGET[region][q];
    const approvedGoal = roundTo(target * APPROVED_COVERAGE[region][q], 5000);
    const live = cell.filter(isLive);
    const liveFixed = live.filter((i) => FEATURED.has(i)).reduce((s, i) => s + i.expected.newPipeline, 0);
    scalePipelineTo(live.filter((i) => !FEATURED.has(i)), approvedGoal - liveFixed);

    const pending = cell.filter(isPending);
    if (pending.length) {
      const gap = Math.max(target - approvedGoal, target * 0.1);
      const pendingGoal = roundTo(gap * PENDING_VS_GAP[region][q], 5000);
      const pendingFixed = pending.filter((i) => FEATURED.has(i)).reduce((s, i) => s + i.expected.newPipeline, 0);
      const movablePending = pending.filter((i) => !FEATURED.has(i));
      scalePipelineTo(movablePending, Math.max(pendingGoal - pendingFixed, movablePending.length * 50000));
    }
    // Rejected and cancelled requests keep a plausible pipeline-to-investment ratio.
    for (const i of cell.filter((x) => x.approvalStatus === 'Rejected' || x.executionStatus === 'Cancelled')) {
      const v = roundTo(i.requestedInvestment * between(9, 18), 5000);
      const kk = v / i.expected.newPipeline;
      i.expected.newPipeline = v;
      i.expected.influencedPipeline = roundTo(i.expected.influencedPipeline * kk, 5000);
    }
  }
}

// Make names unique so the register reads cleanly (featured examples keep their names).
{
  const seen = new Map<string, number>([...FEATURED].map((i) => [i.name, 1]));
  for (const i of initiatives) {
    if (FEATURED.has(i)) continue;
    const n = (seen.get(i.name) ?? 0) + 1;
    seen.set(i.name, n);
    if (n > 1) i.name = `${i.name} · ${i.subregion}${n > 2 ? ` (${i.quarter})` : ''}`;
  }
}

// Sort by quarter then start date; re-sequence IDs so they read chronologically.
initiatives.sort((a, b) => (a.quarter + a.startDate).localeCompare(b.quarter + b.startDate));
const reseq: Record<Quarter, number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
for (const i of initiatives) i.id = `${FY}-${i.quarter}-${String(++reseq[i.quarter]).padStart(4, '0')}`;

// ---------------------------------------------------------------- budgets
// Plan budgets per region x source x quarter, sized from demand so that some pools
// are comfortably funded and others become tight once pending requests are approved.
const budgets: BudgetAllocation[] = [];
const SOURCES: BudgetSource[] = ['Regional Marketing', 'Strategic Partner Funding', 'AWS MDF', 'Corporate Marketing', 'Partner Co-Investment'];
for (const region of ['NA', 'EMEA', 'APJ'] as Region[]) {
  for (const q of QUARTERS) {
    for (const source of SOURCES) {
      let approvedDemand = 0;
      let pendingDemand = 0;
      for (const i of initiatives) {
        if (i.region !== region || i.quarter !== q) continue;
        const share = i.funding.find((f) => f.source === source)?.share ?? 0;
        if (!share) continue;
        if (i.approvalStatus === 'Approved') approvedDemand += i.approvedInvestment * share;
        else if (i.approvalStatus !== 'Rejected') pendingDemand += i.requestedInvestment * share;
      }
      const base = approvedDemand + pendingDemand * between(0.35, 0.8);
      const amount = roundTo(base * between(1.02, 1.15), 5000);
      if (amount > 0) budgets.push({ region, source, quarter: q, amount });
    }
  }
}

// ---------------------------------------------------------------- targets
const targets: RegionalTarget[] = [];
for (const region of ['NA', 'EMEA', 'APJ'] as Region[]) {
  for (const q of QUARTERS) {
    const pipelineTarget = PIPELINE_TARGET[region][q];
    // MQL targets follow the pipeline plan using the region's average pipeline per MQL.
    const regionLive = initiatives.filter((i) => i.region === region && isLive(i));
    const pipePerMql = regionLive.reduce((s, i) => s + i.expected.newPipeline, 0) / regionLive.reduce((s, i) => s + i.expected.mqls, 0);
    const mqlTarget = roundTo((pipelineTarget / pipePerMql) * between(0.95, 1.05), 10);
    targets.push({ region, quarter: q, mqlTarget, pipelineTarget });
  }
}

const dataset: Dataset = {
  fiscalYear: FY,
  asOf: AS_OF,
  featured: {
    reconciliationExampleId: recon.id,
    pipelineExampleId: pipelineExample.id,
  },
  initiatives,
  budgets,
  targets,
};

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/data/dataset.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(dataset, null, 2) + '\n');
console.log(`Wrote ${initiatives.length} initiatives, ${budgets.length} budget lines, ${targets.length} targets -> ${out}`);
