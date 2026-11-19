import type { Route } from '../components/Shell';

export interface TourStep {
  /** Stable id, sent to analytics as step_id. Don't rename once published. */
  id: string;
  /** The view this step lives on. The tour navigates there automatically. */
  route: Route;
  /** CSS selector of the element to spotlight (see the data-tour attributes). Omit for a centred card. */
  target?: string;
  title: string;
  body: string;
  /** An optional action for the visitor, shown in the lime "Try it" box. */
  tryIt?: string;
  /** The step waits until the visitor approves or rejects something. */
  waitFor?: 'decision';
  /** Shown instead of the waiting message when the target can't be found. */
  fallback?: string;
  link?: { label: string; href: string };
}

/**
 * The tour script. Edit the wording here; nothing else needs to change.
 * Targets are `data-tour` attributes on the elements being highlighted.
 */
export const STEPS: TourStep[] = [
  {
    id: 'problem',
    route: 'overview',
    target: '[data-tour="hero"]',
    title: 'The problem',
    body: 'This framework connects initiatives, investment approvals, budget and demand forecasts in one operating model, so every investment is tied to pipeline.',
  },
  {
    id: 'how-it-works',
    route: 'overview',
    target: '[data-tour="nav"]',
    title: 'How it works',
    body: 'Five views, one set of records. A decision in one view recalculates every other. All data is fictional, and changes reset when you leave.',
  },
  {
    id: 'filters',
    route: 'overview',
    target: '[data-tour="filters"]',
    title: 'Start here',
    body: 'Leadership starts by slicing the plan by quarter, region, budget source, category and solution. Every number on the page follows these filters.',
    tryIt: 'Set Region to EMEA and watch the page change.',
  },
  {
    id: 'so-what',
    route: 'overview',
    target: '[data-tour="kpis"]',
    title: 'The so-what',
    body: 'Coverage shows how much of the pipeline target approved programs already cover. Lime tiles flag what needs attention: pending requests and the gap to target.',
  },
  {
    id: 'plan',
    route: 'initiatives',
    target: '[data-tour="view-header"]',
    title: 'Where it is planned',
    body: 'The master register: one row per initiative and one shared taxonomy, so every region plans in the same language. Search, filter and sort, then open any row for the full record.',
  },
  {
    id: 'decide',
    route: 'approvals',
    target: '[data-tour="approve-featured"]',
    title: 'Your turn',
    body: 'Every request follows the same path before money is committed, and reviewers see the effect of a decision before they make it.',
    tryIt: 'Click Approve on this request.',
    waitFor: 'decision',
    fallback: 'Can’t find the request. It may already be decided or hidden by a filter. Use Reset demo to replay, or skip this step.',
  },
  {
    id: 'recalculated',
    route: 'overview',
    target: '[data-tour="kpis"]',
    title: 'Everything recalculated',
    body: 'Your decision flowed through from the same records: pending requests, investment, forecast and coverage have all updated.',
  },
  {
    id: 'reconcile',
    route: 'budget',
    target: '[data-tour="reconcile"]',
    title: 'Where it is reconciled',
    body: 'Approved plans are tracked against POs and actual spend. This example was approved at $25,000 and came in at $21,000, so $4,000 returns to the pool.',
  },
  {
    id: 'forecast',
    route: 'pipeline',
    target: '[data-tour="coverage-matrix"]',
    title: 'Where it is forecast',
    body: 'Is the plan big enough? Each region and quarter is tested against its target. Lime cells are under-covered.',
    tryIt: 'Select a cell to see the proposals behind it.',
  },
  {
    id: 'wrap-up',
    route: 'pipeline',
    title: 'That’s the tour',
    body: 'Keep exploring, or use Reset demo to replay it. Nothing you changed is saved.',
    link: { label: 'Read the case study', href: 'https://danielsullivanportfolio.com/global-planning-framework' },
  },
];
