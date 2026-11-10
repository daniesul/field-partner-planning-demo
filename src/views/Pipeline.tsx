import { LuCheck, LuUndo2, LuX } from 'react-icons/lu';
import { BulletBar, CoverageMeter, HBar } from '../components/charts';
import { ApprovalChip, FilterBar, Legend, Note, Section, ViewHeader } from '../components/ui';
import { filterInitiatives, isLive, isPending, pipelineCell, pipelineMatrix, pipelineToInvestment, safeRatio, type PipelineCell } from '../lib/calculations';
import { count, moneyShort, pct, ratio } from '../lib/format';
import { useStore } from '../state/store';
import type { Quarter, Region } from '../types/models';
import { QUARTERS, REGION_LABEL, REGIONS } from '../types/models';

const UNDER = 0.9;

function MatrixCell({ c, selected, onSelect }: { c: PipelineCell; selected: boolean; onSelect: () => void }) {
  const under = c.coverage !== null && c.coverage < UNDER;
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left p-4 md:p-5 transition-colors relative ${selected ? 'bg-ink text-white' : under ? 'bg-lime hover:bg-lime-deep' : 'bg-white hover:bg-paper'}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-[26px] md:text-[32px] leading-none font-medium">{pct(c.coverage)}</span>
        {under && <span className={`font-mono text-[9.5px] uppercase tracking-[0.08em] ${selected ? 'text-lime' : ''}`}>Under</span>}
      </div>
      <div className={`num text-[11.5px] mt-2 ${selected ? 'text-[#c8c8c0]' : 'text-ink/70'}`}>
        {moneyShort(c.approvedPipeline)} / {moneyShort(c.pipelineTarget)}
      </div>
      <div className={`num text-[11.5px] ${selected ? 'text-[#c8c8c0]' : 'text-ink/70'}`}>
        gap {moneyShort(c.gap)}
        {c.proposedPipeline > 0 && <> · +{moneyShort(c.proposedPipeline)} prop.</>}
      </div>
      <div className={`num text-[11px] mt-1 ${selected ? 'text-[#a8a8a0]' : 'text-ink/55'}`}>MQL {pct(c.mqlCoverage)}</div>
    </button>
  );
}

function Stat({ k, v, sub, hi }: { k: string; v: string; sub?: string; hi?: boolean }) {
  return (
    <div className={`p-4 md:p-5 ${hi ? 'bg-lime' : 'bg-white'}`}>
      <div className="eyebrow !text-[10px]">{k}</div>
      <div className="num text-[24px] md:text-[28px] mt-2 leading-none">{v}</div>
      {sub && <div className="text-[11.5px] text-mute mt-1.5">{sub}</div>}
    </div>
  );
}

export function Pipeline() {
  const { dataset, initiatives, filters, setFilters, decide, openInitiative } = useStore();
  const region: Region = filters.region === 'All' ? 'NA' : filters.region;
  const quarter: Quarter = filters.quarter === 'All' ? 'Q3' : filters.quarter;
  const base = { ...filters, region: 'All' as const, quarter: 'All' as const };
  const matrix = pipelineMatrix(dataset, initiatives, base);
  const rowTotals = REGIONS.map((r) => pipelineCell(dataset, initiatives, { ...base, region: r }));
  const colTotals = QUARTERS.map((q) => pipelineCell(dataset, initiatives, { ...base, quarter: q }));
  const grand = pipelineCell(dataset, initiatives, base);

  const focusF = { ...filters, region, quarter };
  const c = pipelineCell(dataset, initiatives, focusF);
  const inCell = filterInitiatives(initiatives, focusF);
  const proposals = inCell.filter(isPending).sort((a, b) => b.expected.newPipeline - a.expected.newPipeline);
  const decided = inCell.filter((i) => i.approvalStatus === 'Rejected').sort((a, b) => b.expected.newPipeline - a.expected.newPipeline);
  const contributors = inCell.filter(isLive).sort((a, b) => b.expected.newPipeline - a.expected.newPipeline);
  const maxContrib = Math.max(1, ...contributors.map((i) => i.expected.newPipeline), ...proposals.map((i) => i.expected.newPipeline));
  const example = initiatives.find((i) => i.id === dataset.featured.pipelineExampleId);
  const showGuide = region === 'NA' && quarter === 'Q3' && example;

  return (
    <>
      <ViewHeader
        index="05"
        title="Investment to pipeline planning"
        lede="Is the plan big enough? Each region tests its approved and proposed initiatives against quarterly MQL and new-pipeline targets — and sees exactly what an approval does to the gap."
      />
      <FilterBar />

      <Section title="Coverage matrix" kicker="Approved new-pipeline forecast ÷ target · select a cell">
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-[12px] text-[#3a3a3a]">
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-lime border border-ink" /> Under-covered (&lt; {pct(UNDER)})
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3.5 h-3.5 bg-ink" /> Selected
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid grid-cols-[110px_repeat(5,minmax(150px,1fr))] gap-px bg-line border border-line min-w-[880px]">
            <div className="bg-paper" />
            {QUARTERS.map((q) => (
              <div key={q} className="bg-paper px-4 py-3 eyebrow !text-ink">
                FY27 {q}
              </div>
            ))}
            <div className="bg-paper px-4 py-3 eyebrow">Full year</div>
            {REGIONS.map((r, ri) => (
              <div key={r} className="contents">
                <div className="bg-paper px-4 py-4 flex items-center font-display font-extrabold uppercase text-[15px] leading-tight">{REGION_LABEL[r]}</div>
                {QUARTERS.map((q, qi) => (
                  <MatrixCell
                    key={q}
                    c={matrix[ri * 4 + qi]}
                    selected={r === region && q === quarter}
                    onSelect={() => setFilters({ region: r, quarter: q })}
                  />
                ))}
                <div className="bg-paper p-4 md:p-5">
                  <div className="num text-[22px] leading-none">{pct(rowTotals[ri].coverage)}</div>
                  <div className="num text-[11.5px] text-mute mt-2">
                    {moneyShort(rowTotals[ri].approvedPipeline)} / {moneyShort(rowTotals[ri].pipelineTarget)}
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-paper px-4 py-4 eyebrow flex items-center">Global</div>
            {colTotals.map((t, i) => (
              <div key={i} className="bg-paper p-4 md:p-5">
                <div className="num text-[22px] leading-none">{pct(t.coverage)}</div>
                <div className="num text-[11.5px] text-mute mt-2">
                  {moneyShort(t.approvedPipeline)} / {moneyShort(t.pipelineTarget)}
                </div>
              </div>
            ))}
            <div className="bg-ink text-white p-4 md:p-5">
              <div className="num text-[22px] leading-none">{pct(grand.coverage)}</div>
              <div className="num text-[11.5px] text-[#c8c8c0] mt-2">
                {moneyShort(grand.approvedPipeline)} / {moneyShort(grand.pipelineTarget)}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <section className="py-10 md:py-14 border-b border-line">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <div className="eyebrow mb-2">Planning focus</div>
            <h2 className="display text-[40px] md:text-[64px]">
              {REGION_LABEL[region]} <span className="text-mute">·</span> {quarter}
            </h2>
          </div>
          <div className="num text-[14px]">
            Coverage <span className={`text-[20px] px-1 ${c.coverage !== null && c.coverage < UNDER ? 'bg-lime' : ''}`}>{pct(c.coverage)}</span>
            {c.proposedPipeline > 0 && <span className="text-mute"> · {pct(c.coverageWithProposed)} if all proposals approved</span>}
          </div>
        </div>

        {showGuide && (
          <div className="mb-6 border border-ink bg-white p-4 md:p-5 text-[13.5px] leading-relaxed grid md:grid-cols-[auto_1fr] gap-3 items-start">
            <span className="chip bg-lime border-ink">Guided example</span>
            <p>
              North America has a <strong>$10M</strong> Q3 pipeline goal. Approved initiatives forecast <strong>$8.2M</strong> — a <strong>$1.8M</strong> gap.
              Approving <strong>{example.name}</strong> ({moneyShort(example.expected.newPipeline)} new pipeline) lifts the forecast to $8.7M and cuts the gap
              to $1.3M. {example.approvalStatus === 'Approved' ? <em>Approved — reset the demo to replay.</em> : 'Try it below.'}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-line border border-line">
          <Stat k="New pipeline target" v={moneyShort(c.pipelineTarget)} />
          <Stat k="Approved forecast" v={moneyShort(c.approvedPipeline)} sub={`${contributors.length} approved initiatives`} />
          <Stat k="Pipeline coverage" v={pct(c.coverage)} hi={c.coverage !== null && c.coverage < UNDER} />
          <Stat k="Remaining gap" v={moneyShort(c.gap)} hi={c.gap > 0} sub={c.gap > 0 ? `${pct(safeRatio(c.gap, c.pipelineTarget))} of target` : 'Covered'} />
          <Stat k="MQL target" v={count(c.mqlTarget)} />
          <Stat k="Forecast MQLs" v={count(c.mqlForecast)} sub={c.mqlProposed ? `+${count(c.mqlProposed)} proposed` : undefined} />
          <Stat k="MQL coverage" v={pct(c.mqlCoverage)} hi={c.mqlCoverage !== null && c.mqlCoverage < UNDER} />
          <Stat k="Proposed pipeline" v={moneyShort(c.proposedPipeline)} sub={`${proposals.length} pending · ${moneyShort(c.proposedInvestment)} requested`} />
        </div>

        <div className="mt-8 bg-white border border-line p-5 md:p-7">
          <div className="flex flex-wrap justify-between gap-4 mb-4">
            <div className="eyebrow !text-ink">Approved vs. proposed contribution to target</div>
            <Legend
              items={[
                { label: 'Approved', swatch: 'bg-ink' },
                { label: 'Proposed', swatch: 'hatch bg-white' },
                { label: 'Gap', swatch: 'bg-lime' },
              ]}
            />
          </div>
          <BulletBar target={c.pipelineTarget} approved={c.approvedPipeline} proposed={c.proposedPipeline} height="h-12" label={`${REGION_LABEL[region]} ${quarter}`} />
          <div className="flex justify-between num text-[12px] mt-2 text-mute">
            <span>$0</span>
            <span>
              Target <span className="text-ink">{moneyShort(c.pipelineTarget)}</span>
            </span>
          </div>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          <div className="bg-paper p-4 lg:col-span-4 sm:col-span-2">
            <div className="eyebrow">Reported separately — not added to new pipeline</div>
          </div>
          <Stat k="Influenced pipeline" v={moneyShort(c.influencedPipeline)} sub="Approved initiatives" />
          <Stat k="Partner deal registrations" v={count(c.dealRegistrations)} sub="Expected" />
          <Stat k="Deal registration value" v={moneyShort(c.dealRegValue)} sub="Expected" />
          <Stat k="Sourced pipeline to date" v={moneyShort(c.actualPipeline)} sub="Actuals from executed initiatives" />
        </div>
      </section>

      <div className="grid xl:grid-cols-2 gap-x-12">
        <Section title="Proposals" kicker={`Pending in ${REGION_LABEL[region]} ${quarter} · decide here`}>
          {proposals.length === 0 ? (
            <p className="text-[13px] text-mute">No pending proposals in this region and quarter. Select an under-covered cell with proposals above.</p>
          ) : (
            <ul className="border-t border-ink">
              {proposals.map((i) => {
                const lift = safeRatio(c.approvedPipeline + i.expected.newPipeline, c.pipelineTarget);
                return (
                  <li key={i.id} className="py-4 border-b border-line anim-fade">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="num text-[11px] text-mute">{i.id}</span>
                          <ApprovalChip status={i.approvalStatus} />
                        </div>
                        <button className="font-medium text-left leading-snug hover:underline" onClick={() => openInitiative(i.id)}>
                          {i.name}
                        </button>
                        <div className="num text-[12px] text-mute mt-1">
                          {moneyShort(i.requestedInvestment)} · {count(i.expected.mqls)} MQLs · {ratio(pipelineToInvestment(i))} pipeline:invest
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="num text-[18px]">+{moneyShort(i.expected.newPipeline)}</div>
                        <div className="num text-[11.5px] text-mute">
                          coverage → <span className="text-ink">{pct(lift)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <HBar value={i.expected.newPipeline} max={maxContrib} tone="lime" title={`${moneyShort(i.expected.newPipeline)} proposed`} />
                    </div>
                    {i.approvalStatus !== 'Draft' ? (
                      <div className="flex gap-2 mt-3">
                        <button className="btn-solid btn-sm" onClick={() => decide(i.id, 'approve')}>
                          <LuCheck /> Approve
                        </button>
                        <button className="btn-ghost btn-sm" onClick={() => decide(i.id, 'reject')}>
                          <LuX /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 mt-3 items-center">
                        <button className="btn-ghost btn-sm" onClick={() => decide(i.id, 'submit')}>
                          Submit draft
                        </button>
                        <span className="text-[11.5px] text-mute">Drafts must be submitted before a decision.</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {decided.length > 0 && (
            <div className="mt-6">
              <div className="eyebrow mb-2">Rejected in this cell</div>
              {decided.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 py-2 border-b border-line text-[13px] text-mute">
                  <span className="line-through decoration-1 truncate">{i.name}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="num">{moneyShort(i.expected.newPipeline)}</span>
                    <button className="btn-ghost btn-sm !text-ink" onClick={() => decide(i.id, 'reopen')}>
                      <LuUndo2 /> Reopen
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Approved contributors" kicker="Ranked by forecast new pipeline">
          {contributors.length === 0 ? (
            <p className="text-[13px] text-mute">No approved initiatives in this cell.</p>
          ) : (
            <ul className="border-t border-ink">
              {contributors.map((i) => (
                <li key={i.id}>
                  <button className="w-full text-left py-3 border-b border-line hover:bg-white transition-colors" onClick={() => openInitiative(i.id)}>
                    <div className="flex justify-between gap-3 text-[13px]">
                      <span className="truncate font-medium">{i.name}</span>
                      <span className="num shrink-0">{moneyShort(i.expected.newPipeline)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex-1">
                        <HBar value={i.expected.newPipeline} max={maxContrib} title={`${moneyShort(i.expected.newPipeline)} forecast`} />
                      </div>
                      <span className="num text-[11px] text-mute w-[150px] text-right shrink-0">
                        {i.category} · {i.expected.mqls} MQL
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <Note>Bars are scaled by pipeline value, not lead volume, so a 12-person executive dinner is not dwarfed by a webinar with 100 MQLs.</Note>
          </div>
        </Section>
      </div>

      <Section title="Quarterly trajectory" kicker="Coverage by region · 100% = target">
        <div className="grid md:grid-cols-3 gap-px bg-line border border-line">
          {REGIONS.map((r, ri) => (
            <div key={r} className="bg-white p-5">
              <div className="font-display font-extrabold uppercase text-[18px] mb-4">{REGION_LABEL[r]}</div>
              <div className="space-y-3">
                {QUARTERS.map((q, qi) => {
                  const cell = matrix[ri * 4 + qi];
                  return (
                    <button key={q} className="w-full grid grid-cols-[28px_1fr_48px] items-center gap-3 text-left group" onClick={() => setFilters({ region: r, quarter: q })}>
                      <span className={`num text-[12px] ${r === region && q === quarter ? 'bg-ink text-white px-1' : 'text-mute'}`}>{q}</span>
                      <CoverageMeter value={cell.coverage} threshold={UNDER} />
                      <span className="num text-[12px] text-right group-hover:underline">{pct(cell.coverage)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
