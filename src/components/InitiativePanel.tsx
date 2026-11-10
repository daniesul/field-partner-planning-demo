import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LuCheck, LuSend, LuX, LuEye, LuTriangleAlert, LuUndo2 } from 'react-icons/lu';
import { useStore } from '../state/store';
import {
  ALLOWED_ACTIONS,
  allocate,
  pipelineToInvestment,
  spendOf,
  workflowStage,
  type ValidationResult,
  type WorkflowStage,
} from '../lib/calculations';
import { count, date, money, moneyShort, ratio, signedMoney } from '../lib/format';
import type { FinanceStatus, Initiative } from '../types/models';
import { REGION_LABEL } from '../types/models';
import { ExecChip, FinanceChip, StageChip } from './ui';

const STEPS: WorkflowStage[] = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Scheduled', 'Executed'];

export function WorkflowSteps({ initiative }: { initiative: Initiative }) {
  const stage = workflowStage(initiative);
  const rejected = stage === 'Rejected';
  const idx = rejected ? 2 : STEPS.indexOf(stage);
  return (
    <ol className="grid grid-cols-6 gap-px bg-line border border-line" aria-label="Approval workflow">
      {STEPS.map((s, i) => {
        const done = i < idx || (i === idx && !rejected);
        const current = i === idx;
        const label = rejected && i === 3 ? 'Rejected' : s;
        return (
          <li
            key={s}
            className={`px-2 py-2.5 text-center ${
              rejected && i === 3 ? 'bg-white text-alert' : current ? 'bg-lime' : done ? 'bg-ink text-white' : 'bg-white text-mute'
            }`}
            aria-current={current ? 'step' : undefined}
          >
            <div className="font-mono text-[9.5px] opacity-70">{String(i + 1).padStart(2, '0')}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.04em] leading-tight mt-0.5">{label}</div>
          </li>
        );
      })}
    </ol>
  );
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-line text-[13px]">
      <dt className="text-mute">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-6 border-b border-ink/15">
      <h3 className="eyebrow !text-ink mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function InitiativePanel() {
  const { selectedId, openInitiative, initiatives } = useStore();
  const initiative = initiatives.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (!initiative) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && openInitiative(null);
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [initiative, openInitiative]);

  if (!initiative) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={initiative.name}>
      <button className="absolute inset-0 bg-ink/40 cursor-default" aria-label="Close panel" onClick={() => openInitiative(null)} />
      <aside className="relative w-full max-w-[640px] h-full bg-paper border-l border-ink overflow-y-auto anim-slide">
        <PanelBody initiative={initiative} onClose={() => openInitiative(null)} />
      </aside>
    </div>
  );
}

function PanelBody({ initiative: i, onClose }: { initiative: Initiative; onClose: () => void }) {
  const { decide } = useStore();
  const s = spendOf(i);
  const split = allocate(i.approvedInvestment || i.requestedInvestment, i.funding);
  const actions = ALLOWED_ACTIONS[i.approvalStatus];
  const outcomes: { k: string; e: number; a: number | null; m?: boolean }[] = [
    { k: 'Engagements', e: i.expected.engagements, a: i.actual.engagements },
    { k: 'MQLs', e: i.expected.mqls, a: i.actual.mqls },
    { k: 'New pipeline', e: i.expected.newPipeline, a: i.actual.newPipeline, m: true },
    { k: 'Influenced pipeline', e: i.expected.influencedPipeline, a: i.actual.influencedPipeline, m: true },
    { k: 'Deal registrations', e: i.expected.dealRegistrations, a: i.actual.dealRegistrations },
    { k: 'Deal reg. value', e: i.expected.dealRegValue, a: i.actual.dealRegValue, m: true },
  ];

  return (
    <div>
      <div className="sticky top-0 z-10 bg-paper border-b border-ink px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="num text-[12px] text-mute">{i.id}</span>
          <StageChip initiative={i} />
          {i.approvalStatus === 'Approved' && (i.executionStatus === 'In Progress' || i.executionStatus === 'Cancelled') && <ExecChip status={i.executionStatus} />}
        </div>
        <button className="btn-ghost btn-sm !w-8 !px-0" onClick={onClose} aria-label="Close">
          <LuX />
        </button>
      </div>

      <div className="px-6">
        <div className="pt-6 pb-6 border-b border-ink/15">
          <div className="eyebrow mb-2">
            {i.category} · {i.tier} · {REGION_LABEL[i.region]} / {i.subregion}
          </div>
          <h2 className="display text-[34px] md:text-[42px]">{i.name}</h2>
          <p className="mt-4 text-[14px] leading-relaxed text-[#3a3a3a]">{i.description}</p>
        </div>

        <Block title="Execution progress">
          <WorkflowSteps initiative={i} />
          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {actions.includes('submit') && (
                <button className="btn-solid btn-sm" onClick={() => decide(i.id, 'submit')}>
                  <LuSend /> Submit for review
                </button>
              )}
              {actions.includes('review') && (
                <button className="btn-ghost btn-sm" onClick={() => decide(i.id, 'review')}>
                  <LuEye /> Move to review
                </button>
              )}
              {actions.includes('approve') && (
                <button className="btn-solid btn-sm" onClick={() => decide(i.id, 'approve')}>
                  <LuCheck /> Approve {moneyShort(i.requestedInvestment)}
                </button>
              )}
              {actions.includes('reject') && (
                <button className="btn-ghost btn-sm" onClick={() => decide(i.id, 'reject')}>
                  <LuX /> Reject
                </button>
              )}
              {actions.includes('reopen') && (
                <button className="btn-ghost btn-sm" onClick={() => decide(i.id, 'reopen')}>
                  <LuUndo2 /> Reopen for review
                </button>
              )}
            </div>
          )}
        </Block>

        <Block title="Strategic rationale">
          <p className="text-[14px] leading-relaxed">{i.rationale}</p>
          <dl className="mt-4">
            <Row k="Business objective" v={i.objective} />
            <Row k="Primary solution" v={i.solution} />
            <Row k="Market segment" v={i.segment} />
            <Row k="Start date" v={`${date(i.startDate)} · ${i.quarter}`} />
            <Row k="Initiative owner" v={i.owner} />
            <Row k="Partner" v={i.partner ?? '—'} />
          </dl>
        </Block>

        <Block title="Target audience">
          <p className="text-[14px] leading-relaxed">{i.audience}</p>
        </Block>

        <Block title="Proposed investment & budget source">
          <div className="grid grid-cols-2 gap-px bg-line border border-line mb-4">
            <div className="bg-white p-4">
              <div className="eyebrow">Requested</div>
              <div className="num text-[24px] mt-2">{money(i.requestedInvestment)}</div>
            </div>
            <div className={`p-4 ${i.approvalStatus === 'Approved' ? 'bg-ink text-white' : 'bg-white'}`}>
              <div className={`eyebrow ${i.approvalStatus === 'Approved' ? '!text-soft' : ''}`}>Approved</div>
              <div className="num text-[24px] mt-2">{i.approvalStatus === 'Approved' ? money(i.approvedInvestment) : '—'}</div>
            </div>
          </div>
          <dl>
            {i.funding.map((f) => (
              <Row
                key={f.source}
                k={`${f.source} · ${Math.round(f.share * 100)}%`}
                v={<span className="num">{money(split[f.source] ?? 0)}</span>}
              />
            ))}
            <Row k="Pipeline-to-investment (forecast)" v={<span className="num">{ratio(pipelineToInvestment(i))}</span>} />
          </dl>
        </Block>

        <Block title="Actual financial commitments">
          {i.approvalStatus === 'Approved' ? (
            <>
              <dl className="mb-5">
                <Row k="Finance status" v={<FinanceChip status={i.finance.status} />} />
                <Row k="PO number" v={<span className="num">{i.finance.poNumber ?? '—'}</span>} />
                <Row k="PO amount (committed)" v={<span className="num">{money(i.finance.poAmount)}</span>} />
                <Row k="Final actual spend" v={<span className="num">{money(i.finance.actualSpend)}</span>} />
                <Row
                  k="Variance (approved − actual)"
                  v={
                    i.finance.actualSpend === null ? (
                      '—'
                    ) : (
                      <span className={`num px-1 ${s.variance > 0 ? 'bg-lime' : s.variance < 0 ? 'text-alert' : ''}`}>{signedMoney(s.variance)}</span>
                    )
                  }
                />
                <Row k="Currently drawing on budget" v={<span className="num font-medium">{money(s.consumed)}</span>} />
              </dl>
              <FinanceForm key={i.id} initiative={i} />
            </>
          ) : (
            <p className="text-[13px] text-mute">
              {i.approvalStatus === 'Rejected'
                ? 'Rejected — no budget committed and no pipeline counted in forecasts.'
                : 'No commitments yet. Finance tracking opens once the request is approved.'}
            </p>
          )}
        </Block>

        <Block title="Projected vs. actual performance">
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="!bg-paper">Measure</th>
                  <th className="!bg-paper text-right">Projected</th>
                  <th className="!bg-paper text-right">Actual</th>
                  <th className="!bg-paper text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {outcomes.map((o) => {
                  const d = o.a === null || !o.e ? null : o.a / o.e - 1;
                  return (
                    <tr key={o.k}>
                      <td>{o.k}</td>
                      <td className="num text-right">{o.m ? moneyShort(o.e) : count(o.e)}</td>
                      <td className="num text-right">{o.a === null ? '—' : o.m ? moneyShort(o.a) : count(o.a)}</td>
                      <td className="num text-right">
                        {d === null ? '—' : <span className={d < -0.1 ? 'bg-lime px-1' : ''}>{`${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-mute mt-3">
            New pipeline counts toward pipeline targets. Influenced pipeline and partner deal-registration value are tracked separately and never
            added to it.
          </p>
        </Block>
        <div className="h-10" />
      </div>
    </div>
  );
}

const FINANCE_STATUSES: FinanceStatus[] = ['Not Submitted', 'Submitted', 'PO Issued', 'Invoiced', 'Closed'];

function parseAmount(v: string): number | null {
  const t = v.replace(/[$,\s]/g, '');
  if (t === '') return null;
  return Number(t);
}

function FinanceForm({ initiative: i }: { initiative: Initiative }) {
  const { updateFinance } = useStore();
  const initial = useMemo(
    () => ({
      status: i.finance.status,
      poNumber: i.finance.poNumber ?? '',
      poAmount: i.finance.poAmount?.toString() ?? '',
      actualSpend: i.finance.actualSpend?.toString() ?? '',
    }),
    [i],
  );
  const [form, setForm] = useState(initial);
  const [result, setResult] = useState<ValidationResult | null>(null);
  useEffect(() => setForm(initial), [initial]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const submit = () => {
    const r = updateFinance(i.id, {
      status: form.status,
      poNumber: form.poNumber.trim() || null,
      poAmount: parseAmount(form.poAmount),
      actualSpend: parseAmount(form.actualSpend),
    });
    setResult(r);
  };

  return (
    <form
      className="bg-white border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="eyebrow mb-3 !text-ink">Update finance tracking</div>
      <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
        <label>
          <span className="eyebrow block mb-1">Finance status</span>
          <select className="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FinanceStatus })}>
            {FINANCE_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="eyebrow block mb-1">PO number</span>
          <input className="field num" value={form.poNumber} placeholder="PO-00000" onChange={(e) => setForm({ ...form, poNumber: e.target.value })} />
        </label>
        <label>
          <span className="eyebrow block mb-1">PO amount ($)</span>
          <input className="field num" inputMode="decimal" value={form.poAmount} placeholder="0" onChange={(e) => setForm({ ...form, poAmount: e.target.value })} />
        </label>
        <label>
          <span className="eyebrow block mb-1">Final actual spend ($)</span>
          <input
            className="field num"
            inputMode="decimal"
            value={form.actualSpend}
            placeholder="Not reconciled"
            onChange={(e) => setForm({ ...form, actualSpend: e.target.value })}
          />
        </label>
      </div>
      {result && (result.errors.length > 0 || result.warnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-[12px]">
          {result.errors.map((e) => (
            <li key={e} className="text-alert flex gap-2">
              <LuTriangleAlert className="mt-0.5 shrink-0" /> {e}
            </li>
          ))}
          {result.warnings.map((e) => (
            <li key={e} className="flex gap-2">
              <LuTriangleAlert className="mt-0.5 shrink-0" /> {e}
            </li>
          ))}
        </ul>
      )}
      {result?.ok && !dirty && <p className="mt-3 text-[12px] flex gap-2 items-center"><LuCheck /> Saved — budget and variance recalculated.</p>}
      <div className="flex gap-2 mt-4">
        <button type="submit" className="btn-solid btn-sm" disabled={!dirty}>
          Save finance update
        </button>
        {dirty && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => setForm(initial)}>
            Cancel
          </button>
        )}
      </div>
      <p className="text-[11.5px] text-mute mt-3">Recording an actual marks the initiative Executed and Closed; the remaining budget then uses actual spend.</p>
    </form>
  );
}
