# Fieldplan — Global Field & Partner Marketing Planning (Portfolio Demo)

> **PORTFOLIO DEMONSTRATION — SYNTHETIC DATA.** Every initiative, partner, person, budget, target and pipeline figure in this app is fictional.

An interactive recreation of a global field & partner marketing planning framework, originally built as a connected Google Sheets workbook and used across North America, EMEA and APJ. The app shows how strategic planning, investment governance, budget reconciliation, demand forecasting and leadership reporting work together as one operating model.

| # | View | What it demonstrates |
|---|------|----------------------|
| 01 | **Global Investment & Pipeline Overview** | Executive KPIs (initiatives, pending approvals, approved / executed / remaining investment, forecast MQLs and pipeline, target, coverage, gap) with filters for quarter, region, budget source, category and solution. Regional segmentation, investment mix by category × region, and pipeline vs. target by quarter. |
| 02 | **Global Initiative Plan** | The master register: search, filter, sort, four column sets (status & investment · classification · ownership & funding · expected outcomes) and a detail panel with rationale, audience, funding split, finance commitments and projected vs. actual performance. |
| 03 | **Investment Approval Workflow** | Draft → Submitted → Under Review → Approved / Rejected → Scheduled → Executed. A review queue showing each request's strategic case, funding source, expected outcomes, pipeline-to-investment ratio, and the effect of approval on coverage and on the budget pool. Live impact panel and decision log. |
| 04 | **Regional Budget Allocation** | Budget vs. proposed / approved / committed / actual by region, budget source, quarter and category; the $25,000 → $21,000 reconciliation example (+$4,000 released); an editable finance tracker (status, PO #, PO amount, actual spend, variance). |
| 05 | **Investment to Pipeline Planning** | Region × quarter coverage matrix (under-covered cells highlighted), MQL and pipeline coverage, approved vs. proposed contribution, separately reported influenced pipeline and deal registrations, and approve/reject decisions that update coverage instantly. Guided example: NA Q3 $10M target, $8.2M forecast → approve a $500K proposal → $8.7M, gap $1.3M. |

All five views read from one shared dataset held in React state. Approving, rejecting or reconciling anything recalculates every screen. **Reset demo** (top right) restores the original data. Nothing is saved; reloading the page also resets.

---

## Quick start

Requires **Node.js 20+** (`.nvmrc` included).

```bash
npm install          # install dependencies
npm run dev          # local dev server → http://localhost:5173
npm test             # run the calculation & workflow test suite (Vitest)
npm run build        # type-check + production build → dist/
npm run preview      # serve the production build locally
```

Other scripts:

```bash
npm run typecheck      # TypeScript only
npm run generate:data  # regenerate src/data/dataset.json from the seeded generator
```

## Deploy

The build is a static site in `dist/`. Routing is hash-based (`#budget`), so no server rewrites are needed.

**Vercel:** push the repo to GitHub → *Add New Project* → import it. `vercel.json` sets the framework (Vite), build command (`npm run build`) and output (`dist`). Or from the CLI: `npx vercel --prod`.

**Netlify:** push to GitHub → *Add new site → Import an existing project*. `netlify.toml` sets `npm run build` / `dist` and Node 20. Or drag the `dist/` folder onto app.netlify.com/drop after `npm run build`.

---

## Project structure

```
src/
  types/models.ts          Data model (Initiative, BudgetAllocation, RegionalTarget, Filters…)
  data/dataset.json        Synthetic dataset — the single source of truth
  data/index.ts            Loads the dataset; deep-copies it for reset
  lib/calculations.ts      All business logic: filters, spend states, allocation, budget
                           breakdowns, pipeline coverage, approval workflow, finance validation
  lib/calculations.test.ts Vitest suite (26 tests)
  lib/format.ts            Display formatting only
  state/store.tsx          React context: dataset, filters, decisions, finance updates, reset
  components/              Shell, filters, KPI tiles, chips, chart primitives, detail panel
  views/                   One file per view
  styles/index.css         Tailwind v4 theme tokens and component utilities
scripts/generate-data.ts   Seeded synthetic data generator
```

### How the model maps to the original workbook

| Workbook tab | App equivalent |
|---|---|
| Global Initiative Entry (request ID, approval & execution status, category, tier, solution, audience, segment, region/subregion, requestor, partner, budget name/source, AWS / marketing / other budget, finance tracker, PO #, goals & actuals, expected / influenced pipeline, deal regs) | `Initiative` |
| Budget Data (region × budget type × quarter) | `BudgetAllocation` (region × source × quarter) |
| Spend & In-Planning Summary, regional reporting tabs (budget / executed / approved / in-planning / remaining) | `budgetBreakdown()`, `overviewMetrics()` |
| Investment to Pipeline Planning (MQL & pipeline goal vs. forecast by region and quarter) | `RegionalTarget`, `pipelineCell()`, `pipelineMatrix()` |

## Calculation rules

Defined once in `src/lib/calculations.ts` and covered by tests.

| Term | Rule |
|---|---|
| **Proposed** | Requested amount on Draft / Submitted / Under Review requests. Shown as "in planning"; never deducted from budget. |
| **Approved** | Amount authorised at approval. Rejected requests are always $0. |
| **Committed** | PO amount raised with finance (PO Issued, Invoiced or Closed). |
| **Actual** | Final reconciled spend after execution. |
| **Draw on budget** | The most mature figure: actual → else PO → else approved. Cancelled with no actual = $0. |
| **Remaining** | Budget − draw. |
| **Variance** | Approved − actual (positive = funding released back to the pool). |
| **Forecast pipeline** | Expected *new* pipeline of approved, non-cancelled initiatives. |
| **Proposed pipeline** | Expected new pipeline of pending requests, shown separately. |
| **Influenced pipeline / deal-reg value** | Always reported separately and never added to new pipeline. |

**No double counting.** Each initiative's funding shares sum to 1. Dollar amounts are split across sources with integer rounding and the remainder goes to the largest share, so source-level totals always add back to the overall total. With a budget-source filter active, every measure shows only that source's share.

**Validation.** Finance updates are rejected if amounts are negative, non-numeric or above $5M, if a PO amount has no PO number, or if the initiative isn't approved. Over-commitment and overspend give a warning but are allowed. Ratios return "—" rather than NaN/∞ when the denominator is zero. Invalid workflow transitions (e.g. approving a draft) throw.

## Replacing the synthetic data

Everything is computed from `src/data/dataset.json`, so you replace one file:

1. Export your register, budgets and targets (e.g. from Google Sheets as CSV).
2. Transform them into the `Dataset` shape in `src/types/models.ts`:
   - `initiatives[]`: one per row. Map approval and execution statuses to the allowed values. `funding` is a list of `{ source, share }` whose shares sum to 1 (e.g. AWS budget $15K + marketing $5K → `AWS MDF 0.75`, `Regional Marketing 0.25`). `approvedInvestment` must be 0 unless approved.
   - `budgets[]`: one per region × source × quarter.
   - `targets[]`: MQL and new-pipeline targets per region × quarter.
   - `asOf`, `fiscalYear`, and `featured` (IDs of the reconciliation and pipeline examples shown in the guided callouts).
3. Run `npm test`. The integrity tests catch shares that don't sum to 1, approved amounts on unapproved records, missing budgets or targets, and similar issues.

To change region, source or category names, edit the unions and arrays in `src/types/models.ts`. TypeScript will flag every place that needs to follow.

To adjust the fictional scenario instead, edit `scripts/generate-data.ts` (envelopes, targets, coverage levels, featured examples) and run `npm run generate:data`. It is seeded, so the output is deterministic.

## Tech

React 19 · TypeScript (strict) · Vite · Tailwind CSS v4 · Lucide icons (via `react-icons/lu`) · Vitest. Charts are small dependency-free HTML/CSS components (`src/components/charts.tsx`) built for this monochrome-plus-lime design. They are scaled by value, so high-value, low-volume programs like executive dinners aren't dwarfed by lead counts. No backend, authentication, database or paid APIs.

Fonts: Archivo, Inter and IBM Plex Mono (Google Fonts, SIL OFL). The visual identity is original and only inspired by editorial sportswear sites. It uses no third-party brand assets.
