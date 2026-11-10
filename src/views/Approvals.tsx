import type { ReactNode } from 'react';
import { LuArrowRight, LuCheck, LuEye, LuSend, LuTriangleAlert, LuUndo2, LuX } from 'react-icons/lu';
import { CoverageMeter } from '../components/charts';
import { ApprovalChip, Empty, FilterBar, Note, ViewHeader } from '../components/ui';
import {
  allocate,
  filterInitiatives,
  overviewMetrics,
  pipelineCell,
  pipelineToInvestment,
  workflowStage,
  type WorkflowStage,
} from '../lib/calculations';
import { count, date, money, moneyShort, pct, ratio } from '../lib/format';
import { useStore } from '../state/store';
import type { Initiative } from '../types/models';
import { EMPTY_FILTERS, REGION_LABEL } from '../types/models';

function StageFlow({ list }: { list: Initiative[] }) {
  const n = (s: WorkflowStage) => list.filter((i) => workflowStage(i) === s).length;
  const approvedTotal = list.filter((i) => i.approvalStatus === 'Approved').length;
  const Cell = ({ label, value, tone = 'bg-white', sub }: { label: string; value: number; tone?: string; sub?: string }) => (
    <div className={`${tone} p-4 flex-1 min-w-[110px]`}>
      <div className="font-mono text-[10.5px] uppercase tracking-[0.08em] opacity-70">{label}</div>
      <div className="num text-[28px] mt-1 leading-none">{value}</div>
      {sub && <div className="text-[11px] opacity-70 mt-1">{sub}</div>}
    </div>
  );
  const Arrow = () => (
    <div className="hidden lg:flex items-center px-1 text-mute" aria-hidden>
      <LuArrowRight />
    </div>
  );
  return (
    <div className="flex flex-col lg:flex-row lg:items-stretch gap-px lg:gap-0 bg-line lg:bg-transparent border border-line lg:border-0">
      <Cell label="01 Draft" value={n('Draft')} sub="Not yet submitted" />
      <Arrow />
      <Cell label="02 Submitted" value={n('Submitted')} tone="bg-white" sub="Awaiting triage" />
      <Arrow />
      <Cell label="03 Under review" value={n('Under Review')} tone="bg-lime" sub="Decision required" />
      <Arrow />
      <div className="flex lg:flex-col flex-1 min-w-[140px] gap-px bg-line">
        <Cell label="04 Approved" value={approvedTotal} tone="bg-ink text-white" />
        <Cell label="04 Rejected" value={n('Rejected')} />
      </div>
      <Arrow />
      <Cell label="05 Scheduled" value={n('Scheduled')} sub="Approved, in delivery" />
      <Arrow />
      <Cell label="06 Executed" value={n('Executed')} sub="Delivered & reconciled" />
    </div>
  );
}

function Field({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{k}</dt>
      <dd className="mt-1 text-[13px] leading-snug">{children}</dd>
    </div>
  );
}

function QueueCard({ i }: { i: Initiative }) {
  const { dataset, initiatives, decide, openInitiative } = useStore();
  const scope = { ...EMPTY_FILTERS, region: i.region, quarter: i.quarter };
  const cell = pipelineCell(dataset, initiatives, scope);
  const after = cell.approvedPipeline + i.expected.newPipeline;
  const afterCov = cell.pipelineTarget ? after / cell.pipelineTarget : null;
  const split = allocate(i.requestedInvestment, i.funding);
  const pools = i.funding.map((f) => {
    const remaining = overviewMetrics(dataset, initiatives, { ...scope, source: f.source }).remainingBudget;
    const draw = split[f.source] ?? 0;
    return { source: f.source, remaining, after: remaining - draw, draw };
  });
  const overBudget = pools.some((p) => p.after < 0);
  const r = pipelineToInvestment(i);

  return (
    <article className="bg-white border border-line hover:border-ink transition-colors anim-fade">
      <div className="p-5 md:p-6 border-b border-line">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="num text-[12px] text-mute">{i.id}</span>
          <ApprovalChip status={i.approvalStatus} />
          <span className="chip border-line text-[#3a3a3a]">{i.category}</span>
          <span className="chip border-line text-[#3a3a3a]">{i.tier}</span>
        </div>
        <button className="text-left" onClick={() => openInitiative(i.id)}>
          <h3 className="font-display font-extrabold uppercase text-[22px] md:text-[26px] leading-[1.02] hover:underline decoration-2 underline-offset-4">{i.name}</h3>
        </button>
        <p className="text-[13.5px] text-[#3a3a3a] mt-2 leading-relaxed">{i.description}</p>
      </div>

      <dl className="p-5 md:p-6 grid sm:grid-cols-2 gap-5 border-b border-line">
        <Field k="Strategic objective">
          <span className="font-medium">{i.objective}</span> — {i.rationale}
        </Field>
        <Field k="Target market & audience">
          {REGION_LABEL[i.region]} · {i.subregion} · {i.segment}
          <span className="block text-mute mt-1">{i.audience}</span>
        </Field>
        <Field k="Budget source">
          {i.funding.map((f) => (
            <span key={f.source} className="block">
              {f.source} <span className="num text-mute">{money(split[f.source] ?? 0)}</span>
            </span>
          ))}
        </Field>
        <Field k="Timing · owner">
          {date(i.startDate)} · {i.quarter} · {i.owner}
          {i.partner && <span className="block text-mute">Partner: {i.partner}</span>}
        </Field>
      </dl>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-px bg-line border-b border-line">
        {[
          ['Requested', money(i.requestedInvestment), true],
          ['Engagements', count(i.expected.engagements)],
          ['MQLs', count(i.expected.mqls)],
          ['New pipeline', moneyShort(i.expected.newPipeline), true],
          ['Deal regs', i.expected.dealRegistrations ? `${i.expected.dealRegistrations} · ${moneyShort(i.expected.dealRegValue)}` : '—'],
          ['Pipeline : invest', ratio(r)],
        ].map(([k, v, strong]) => (
          <div key={k as string} className="bg-white p-3 md:p-4">
            <div className="eyebrow !text-[10px]">{k}</div>
            <div className={`num mt-1.5 ${strong ? 'text-[17px] font-medium' : 'text-[15px]'}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="p-5 md:p-6 grid md:grid-cols-2 gap-5 bg-paper/60">
        <div>
          <div className="eyebrow mb-2">
            If approved · {REGION_LABEL[i.region]} {i.quarter} coverage
          </div>
          <div className="num text-[15px] mb-2">
            {pct(cell.coverage)} <span className="text-mute">→</span> <span className="bg-lime px-1">{pct(afterCov)}</span>
            <span className="text-mute text-[12px] ml-2">gap {moneyShort(cell.gap)} → {moneyShort(Math.max(cell.pipelineTarget - after, 0))}</span>
          </div>
          <CoverageMeter value={afterCov} />
        </div>
        <div>
          <div className="eyebrow mb-2">Budget pool after approval</div>
          {pools.map((p) => (
            <div key={p.source} className="flex justify-between text-[12.5px] py-0.5">
              <span className="text-mute">{p.source}</span>
              <span className={`num ${p.after < 0 ? 'text-alert font-medium' : ''}`}>
                {moneyShort(p.remaining)} → {moneyShort(p.after)}
              </span>
            </div>
          ))}
          {overBudget && (
            <div className="flex gap-1.5 items-center text-[12px] text-alert mt-1.5">
              <LuTriangleAlert /> Exceeds the planned pool — approval would overcommit this budget.
            </div>
          )}
        </div>
      </div>

      <div className="p-4 md:px-6 flex flex-wrap gap-2 border-t border-line">
        <button className="btn-solid" onClick={() => decide(i.id, 'approve')}>
          <LuCheck /> Approve
        </button>
        <button className="btn-ghost" onClick={() => decide(i.id, 'reject')}>
          <LuX /> Reject
        </button>
        {i.approvalStatus === 'Submitted' && (
          <button className="btn-ghost" onClick={() => decide(i.id, 'review')}>
            <LuEye /> Move to review
          </button>
        )}
        <button className="ml-auto font-mono text-[11px] uppercase tracking-[0.08em] underline underline-offset-4 hover:no-underline" onClick={() => openInitiative(i.id)}>
          Full record
        </button>
      </div>
    </article>
  );
}

export function Approvals() {
  const { dataset, initiatives, filters, activity, decide, openInitiative } = useStore();
  const scoped = filterInitiatives(initiatives, filters);
  const queue = scoped
    .filter((i) => i.approvalStatus === 'Under Review' || i.approvalStatus === 'Submitted')
    .sort((a, b) => (a.approvalStatus === b.approvalStatus ? a.startDate.localeCompare(b.startDate) : a.approvalStatus === 'Under Review' ? -1 : 1));
  const drafts = scoped.filter((i) => i.approvalStatus === 'Draft');
  const rejected = scoped.filter((i) => i.approvalStatus === 'Rejected');
  const m = overviewMetrics(dataset, initiatives, filters);
  const featured = initiatives.find((i) => i.id === dataset.featured.pipelineExampleId);

  return (
    <>
      <ViewHeader
        index="03"
        title="Investment approval workflow"
        lede="Every request follows the same governance path before money is committed. Reviewers see the strategic case, the funding source and the forecast return side by side — and the effect of a decision on budget and pipeline before they make it."
      />
      <FilterBar />

      <section className="py-8 border-b border-line">
        <div className="eyebrow mb-3">Draft → Submitted → Under Review → Approved / Rejected → Scheduled → Executed</div>
        <StageFlow list={scoped} />
      </section>

      <div className="grid xl:grid-cols-[1fr_380px] gap-8 xl:gap-12 py-10">
        <div>
          <div className="flex items-end justify-between mb-5 gap-4">
            <h2 className="display text-[30px] md:text-[40px]">Review queue</h2>
            <span className="num text-[13px] text-mute">
              {queue.length} awaiting decision · {moneyShort(queue.reduce((s, i) => s + i.requestedInvestment, 0))}
            </span>
          </div>
          {featured && (featured.approvalStatus === 'Under Review' || featured.approvalStatus === 'Submitted') && queue.some((q) => q.id === featured.id) && (
            <div className="mb-5 border border-ink bg-lime p-4 text-[13px] leading-relaxed">
              <strong className="font-mono uppercase text-[11px] tracking-[0.08em] mr-2">Try it</strong>
              Approve <strong>{featured.name}</strong> and watch North America Q3 pipeline coverage move from 82% to 87% — here, on the Overview and in
              Pipeline Planning.
            </div>
          )}
          {queue.length === 0 ? <Empty>Nothing awaiting review for these filters.</Empty> : <div className="space-y-6">{queue.map((i) => <QueueCard key={i.id} i={i} />)}</div>}

          {drafts.length > 0 && (
            <div className="mt-12">
              <h3 className="display text-[24px] mb-4">Drafts · not yet submitted</h3>
              <ul className="border-t border-ink">
                {drafts.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-3 border-b border-line">
                    <span className="num text-[12px] text-mute">{i.id}</span>
                    <button className="font-medium text-left hover:underline flex-1 min-w-[200px]" onClick={() => openInitiative(i.id)}>
                      {i.name}
                    </button>
                    <span className="num text-[13px]">{moneyShort(i.requestedInvestment)}</span>
                    <button className="btn-ghost btn-sm" onClick={() => decide(i.id, 'submit')}>
                      <LuSend /> Submit
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {rejected.length > 0 && (
            <div className="mt-12">
              <h3 className="display text-[24px] mb-1">Rejected</h3>
              <Note>Rejected requests contribute nothing to approved investment or committed pipeline. They can be reopened for review.</Note>
              <ul className="border-t border-ink mt-4">
                {rejected.map((i) => (
                  <li key={i.id} className="flex flex-wrap items-center gap-3 py-3 border-b border-line text-mute">
                    <span className="num text-[12px]">{i.id}</span>
                    <button className="text-left hover:underline flex-1 min-w-[200px] line-through decoration-1" onClick={() => openInitiative(i.id)}>
                      {i.name}
                    </button>
                    <span className="num text-[13px]">{moneyShort(i.requestedInvestment)}</span>
                    <button className="btn-ghost btn-sm !text-ink" onClick={() => decide(i.id, 'reopen')}>
                      <LuUndo2 /> Reopen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-[calc(var(--nav-h)+90px)] self-start space-y-6">
          <div className="bg-ink text-white p-6">
            <div className="eyebrow !text-soft mb-4">Live impact · current filters</div>
            <dl className="space-y-4">
              {[
                ['Approved investment', moneyShort(m.approvedInvestment)],
                ['Remaining budget', moneyShort(m.remainingBudget)],
                ['Committed pipeline forecast', moneyShort(m.forecastPipeline)],
                ['Pipeline target', moneyShort(m.pipelineTarget)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between items-baseline border-b border-white/15 pb-3">
                  <dt className="text-[13px] text-[#c8c8c0]">{k}</dt>
                  <dd className="num text-[20px]">{v}</dd>
                </div>
              ))}
              <div>
                <div className="flex justify-between items-baseline mb-2">
                  <dt className="text-[13px] text-[#c8c8c0]">Coverage</dt>
                  <dd className="num text-[20px]">
                    <span className={m.coverage !== null && m.coverage < 0.9 ? 'bg-lime text-ink px-1' : ''}>{pct(m.coverage)}</span>
                  </dd>
                </div>
                <div className="bg-white/10 p-1">
                  <CoverageMeter value={m.coverage} />
                </div>
              </div>
            </dl>
          </div>
          <div className="bg-white border border-line">
            <div className="px-5 py-4 border-b border-line flex justify-between items-center">
              <span className="eyebrow !text-ink">Decision log</span>
              <span className="num text-[11px] text-mute">{activity.length}</span>
            </div>
            {activity.length === 0 ? (
              <p className="p-5 text-[13px] text-mute">Decisions you make appear here with their effect on forecast and budget.</p>
            ) : (
              <ol className="max-h-[420px] overflow-y-auto">
                {activity.map((a) => (
                  <li key={a.id} className="px-5 py-4 border-b border-line last:border-0 anim-fade">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 w-2 h-2 shrink-0 ${a.kind === 'approve' ? 'bg-ink' : a.kind === 'reject' ? 'border border-ink' : a.kind === 'finance' ? 'bg-lime border border-ink' : 'bg-soft'}`}
                        aria-hidden
                      />
                      <div>
                        <div className="text-[13px] font-medium leading-snug">{a.title}</div>
                        <div className="text-[12px] text-mute mt-1 leading-relaxed">{a.detail}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
