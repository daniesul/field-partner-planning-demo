import { LuArrowUpRight } from 'react-icons/lu';
import { BulletBar, CoverageMeter, HBar } from '../components/charts';
import { FilterBar, Kpi, KpiGrid, Legend, Note, Section } from '../components/ui';
import { investmentByCategoryRegion, overviewMetrics, pipelineCell } from '../lib/calculations';
import { count, moneyShort, pct } from '../lib/format';
import { useStore } from '../state/store';
import { QUARTERS, REGION_LABEL, REGIONS } from '../types/models';

const PILLARS = [
  { n: '01', t: 'Strategic planning', d: 'One view for every global and regional initiative, categorised and tiered against business objectives.', href: '#initiatives' },
  { n: '02', t: 'Investment governance', d: 'A standard request → review → decision workflow before investment is committed.', href: '#approvals' },
  { n: '03', t: 'Financial accountability', d: 'Approved plans reconciled to POs and actual spend, by region and budget source.', href: '#budget' },
  { n: '04', t: 'Demand forecasting', d: 'Every initiative carries an MQL and pipeline forecast that rolls up to targets.', href: '#pipeline' },
  { n: '05', t: 'Leadership visibility', d: 'Executives see coverage, gaps and investment mix — filtered any way they need.', href: '#overview' },
];

function Intro() {
  return (
    <section className="pt-12 md:pt-20 pb-12 md:pb-16 border-b border-ink">
      <h1 data-tour="hero" className="display text-[34px] xs:text-[52px] md:text-[96px] xl:text-[132px] max-w-[16ch] break-words">
        From fragmented planning to <span className="bg-lime px-2 -mx-1 box-decoration-clone">pipeline accountability</span>
      </h1>
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 mt-10 md:mt-14">
        <div className="space-y-5 text-[16px] md:text-[18px] leading-relaxed max-w-2xl">
          <p>
            Designed and implemented a global planning framework connecting marketing initiatives, investment approvals, budget allocation, and
            demand forecasting.
          </p>
          <p className="text-[#3a3a3a]">
            Built to give field and partner marketing teams across North America, EMEA and APJ a standardized operating model while providing
            leadership with the visibility needed to evaluate investment priorities, forecast pipeline contribution, and make more informed
            decisions.
          </p>
        </div>
        <div className="border border-ink p-6 bg-white self-start">
          <div className="eyebrow !text-ink mb-3">About this demonstration</div>
          <p className="text-[14px] leading-relaxed text-[#3a3a3a]">
            The original framework ran as a connected Google Sheets workbook. This interactive version recreates its operating model — initiative
            register, approval workflow, budget reconciliation and investment-to-pipeline planning — using{' '}
            <strong>100% fictional data</strong>. Approve or reject requests, record actual spend, and watch every view recalculate from the same
            records.
          </p>
        </div>
      </div>
      <ol className="grid sm:grid-cols-2 lg:grid-cols-5 gap-px bg-line border border-line mt-12">
        {PILLARS.map((p) => (
          <li key={p.n}>
            <a href={p.href} className="group block h-full bg-paper hover:bg-white p-5 transition-colors">
              <div className="flex justify-between items-start">
                <span className="num text-[12px] text-mute">{p.n}</span>
                <LuArrowUpRight className="opacity-30 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="font-display font-extrabold uppercase text-[17px] mt-6 leading-tight">{p.t}</div>
              <p className="text-[13px] text-mute mt-2 leading-relaxed">{p.d}</p>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function Overview() {
  const { dataset, initiatives, filters } = useStore();
  const m = overviewMetrics(dataset, initiatives, filters);
  const regionCells = REGIONS.filter((r) => filters.region === 'All' || filters.region === r).map((r) => ({
    r,
    cell: pipelineCell(dataset, initiatives, { ...filters, region: r }),
    metrics: overviewMetrics(dataset, initiatives, { ...filters, region: r }),
  }));
  const quarterCells = QUARTERS.filter((q) => filters.quarter === 'All' || filters.quarter === q).map((q) => ({
    q,
    cell: pipelineCell(dataset, initiatives, { ...filters, quarter: q }),
  }));
  const cats = investmentByCategoryRegion(initiatives, filters);
  const catMax = Math.max(1, ...cats.flatMap((c) => [c.NA, c.EMEA, c.APJ]));
  const totals = { NA: 0, EMEA: 0, APJ: 0, total: 0, proposed: 0 };
  for (const c of cats) {
    totals.NA += c.NA;
    totals.EMEA += c.EMEA;
    totals.APJ += c.APJ;
    totals.total += c.total;
    totals.proposed += c.proposed;
  }
  const qMax = Math.max(...quarterCells.map(({ cell }) => Math.max(cell.pipelineTarget, cell.approvedPipeline + cell.proposedPipeline)), 1) * 1.05;
  const rMax = Math.max(...regionCells.map(({ cell }) => Math.max(cell.pipelineTarget, cell.approvedPipeline + cell.proposedPipeline)), 1) * 1.05;
  const budgetScoped = filters.category !== 'All' || filters.solution !== 'All';

  return (
    <>
      <Intro />
      <header className="pt-12 md:pt-16 pb-6">
        <div className="eyebrow mb-4">View 01 / 05 · FY27 · as of {dataset.asOf}</div>
        <h2 className="display text-[36px] xs:text-[52px] md:text-[80px] xl:text-[96px] max-w-[18ch]">Global investment &amp; pipeline overview</h2>
      </header>
      <FilterBar />

      <div data-tour="kpis" className="mt-8">
        <KpiGrid>
          <Kpi label="Planned initiatives" value={count(m.totalInitiatives)} sub="In scope of current filters" />
          <Kpi label="Pending approval" value={count(m.pendingApproval)} sub={`${moneyShort(m.proposedInvestment)} requested, incl. drafts`} tone={m.pendingApproval ? 'lime' : 'default'} />
          <Kpi label="Approved investment" value={moneyShort(m.approvedInvestment)} sub={`of ${moneyShort(m.budget)} budget`} />
          <Kpi label="Executed investment" value={moneyShort(m.executedInvestment)} sub="Reconciled actual spend" />
          <Kpi
            label="Remaining budget"
            value={moneyShort(m.remainingBudget)}
            sub={budgetScoped ? 'Budget pool for region · quarter · source' : 'Budget − consumed (actual → PO → approved)'}
            tone="ink"
          />
          <Kpi label="Forecasted MQLs" value={count(m.forecastMqls)} sub="Approved initiatives" />
          <Kpi label="Forecasted pipeline" value={moneyShort(m.forecastPipeline)} sub="New pipeline · approved initiatives" />
          <Kpi label="Pipeline target" value={moneyShort(m.pipelineTarget)} sub="Region × quarter plan" />
          <Kpi label="Pipeline coverage" value={pct(m.coverage)} sub={<CoverageMeter value={m.coverage} />} />
          <Kpi label="Gap to target" value={moneyShort(m.gap)} sub={m.gap > 0 ? 'Needs approved programs' : 'Target covered'} tone={m.gap > 0 ? 'lime' : 'default'} />
        </KpiGrid>
        {budgetScoped && (
          <div className="mt-3">
            <Note>
              Budgets are planned by region, quarter and source. With a category or solution filter, remaining budget shows the matching pool
              minus what those initiatives consume; pipeline targets are not split by category, so coverage reads as contribution to target.
            </Note>
          </div>
        )}
      </div>

      <Section title="Regional segmentation" kicker="North America · EMEA · APJ">
        <div className="grid md:grid-cols-3 gap-px bg-line border border-line">
          {regionCells.map(({ r, cell, metrics }) => (
            <div key={r} className="bg-white p-6">
              <div className="flex items-baseline justify-between">
                <h3 className="display text-[30px]">{REGION_LABEL[r]}</h3>
                <span className={`num text-[13px] px-1.5 ${cell.coverage !== null && cell.coverage < 0.9 ? 'bg-lime' : ''}`}>{pct(cell.coverage)}</span>
              </div>
              <div className="mt-5">
                <BulletBar target={cell.pipelineTarget} approved={cell.approvedPipeline} proposed={cell.proposedPipeline} max={rMax} label={REGION_LABEL[r]} />
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-y-3 gap-x-4 text-[12px]">
                {[
                  ['Pipeline forecast', moneyShort(cell.approvedPipeline)],
                  ['Target', moneyShort(cell.pipelineTarget)],
                  ['Gap', moneyShort(cell.gap)],
                  ['MQLs (fcst / tgt)', `${count(cell.mqlForecast)} / ${count(cell.mqlTarget)}`],
                  ['Approved invest.', moneyShort(metrics.approvedInvestment)],
                  ['Remaining budget', moneyShort(metrics.remainingBudget)],
                  ['Initiatives', count(metrics.totalInitiatives)],
                  ['Pending', count(metrics.pendingApproval)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-mute">{k}</dt>
                    <dd className="num text-[15px] mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid xl:grid-cols-[1.15fr_1fr] gap-x-12">
        <Section title="Investment mix" kicker="Approved investment · category × region">
          <div className="overflow-x-auto">
            <table className="tbl min-w-[560px]">
              <thead>
                <tr>
                  <th className="!bg-paper">Category</th>
                  {REGIONS.map((r) => (
                    <th key={r} className="!bg-paper w-[22%]">
                      {r}
                    </th>
                  ))}
                  <th className="!bg-paper text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {cats.map((c) => (
                  <tr key={c.category}>
                    <td className="font-medium whitespace-nowrap">{c.category}</td>
                    {REGIONS.map((r) => (
                      <td key={r}>
                        <div className="num text-[12px] mb-1">{c[r] ? moneyShort(c[r]) : '—'}</div>
                        <HBar value={c[r]} max={catMax} title={`${c.category} · ${REGION_LABEL[r]}: ${moneyShort(c[r])}`} />
                      </td>
                    ))}
                    <td className="num text-right">
                      {moneyShort(c.total)}
                      {c.proposed > 0 && <div className="text-[11px] text-mute">+{moneyShort(c.proposed)} pending</div>}
                    </td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="!border-b-0 !border-t !border-t-ink">Total</td>
                  {REGIONS.map((r) => (
                    <td key={r} className="num !border-b-0 !border-t !border-t-ink">
                      {moneyShort(totals[r])}
                    </td>
                  ))}
                  <td className="num text-right !border-b-0 !border-t !border-t-ink">{moneyShort(totals.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="Pipeline vs. target" kicker="New pipeline by quarter">
          <div className="mb-5">
            <Legend
              items={[
                { label: 'Approved forecast', swatch: 'bg-ink' },
                { label: 'Proposed (pending)', swatch: 'hatch bg-white' },
                { label: 'Gap to target', swatch: 'bg-lime' },
                { label: 'Target', swatch: 'bg-white !border-0 !w-[2px] !h-4 !bg-ink' },
              ]}
            />
          </div>
          <div className="space-y-6">
            {quarterCells.map(({ q, cell }) => (
              <div key={q}>
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                  <span className="font-display font-extrabold text-[20px]">FY27 {q}</span>
                  <span className="num text-[12px] text-mute">
                    <span className="text-ink">{moneyShort(cell.approvedPipeline)}</span> of {moneyShort(cell.pipelineTarget)} ·{' '}
                    <span className={cell.coverage !== null && cell.coverage < 0.9 ? 'bg-lime text-ink px-1' : 'text-ink'}>{pct(cell.coverage)}</span>
                  </span>
                </div>
                <BulletBar target={cell.pipelineTarget} approved={cell.approvedPipeline} proposed={cell.proposedPipeline} max={qMax} label={`FY27 ${q}`} />
              </div>
            ))}
          </div>
          <div className="mt-6">
            <Note>Influenced pipeline and partner deal-registration value are reported separately in Pipeline Planning and are not included here.</Note>
          </div>
        </Section>
      </div>
    </>
  );
}
