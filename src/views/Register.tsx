import { useMemo, useState, type ReactNode } from 'react';
import { LuArrowDown, LuArrowUp, LuChevronRight, LuSearch } from 'react-icons/lu';
import { ApprovalChip, Empty, ExecChip, FilterBar, StageChip, ViewHeader } from '../components/ui';
import { filterInitiatives, searchInitiatives, sumSpend } from '../lib/calculations';
import { count, date, money, moneyShort } from '../lib/format';
import { useStore } from '../state/store';
import type { ApprovalStatus, Initiative } from '../types/models';
import { REGION_LABEL } from '../types/models';

type Group = 'core' | 'classification' | 'funding' | 'outcomes';
const GROUPS: { id: Group; label: string }[] = [
  { id: 'core', label: 'Status & investment' },
  { id: 'classification', label: 'Classification' },
  { id: 'funding', label: 'Ownership & funding' },
  { id: 'outcomes', label: 'Expected outcomes' },
];

interface Col {
  key: string;
  label: string;
  groups: Group[];
  align?: 'right';
  sort: (i: Initiative) => string | number;
  render: (i: Initiative) => ReactNode;
}

const sourceLabel = (i: Initiative) => i.funding.map((f) => (i.funding.length > 1 ? `${f.source} ${Math.round(f.share * 100)}%` : f.source)).join(' + ');

const COLUMNS: Col[] = [
  { key: 'approval', label: 'Approval', groups: ['core'], sort: (i) => i.approvalStatus, render: (i) => <ApprovalChip status={i.approvalStatus} /> },
  { key: 'execution', label: 'Execution', groups: ['core'], sort: (i) => i.executionStatus, render: (i) => <ExecChip status={i.executionStatus} /> },
  { key: 'category', label: 'Category', groups: ['core', 'classification'], sort: (i) => i.category, render: (i) => i.category },
  { key: 'start', label: 'Start date', groups: ['classification'], sort: (i) => i.startDate, render: (i) => <span className="num whitespace-nowrap">{date(i.startDate)}</span> },
  { key: 'quarter', label: 'Qtr', groups: ['core', 'classification'], sort: (i) => i.quarter, render: (i) => <span className="num">{i.quarter}</span> },
  { key: 'tier', label: 'Tier', groups: ['classification'], sort: (i) => i.tier, render: (i) => <span className="num">{i.tier}</span> },
  { key: 'solution', label: 'Solution', groups: ['classification'], sort: (i) => i.solution, render: (i) => i.solution },
  { key: 'objective', label: 'Objective', groups: ['classification'], sort: (i) => i.objective, render: (i) => <span className="whitespace-nowrap">{i.objective}</span> },
  { key: 'segment', label: 'Segment', groups: ['classification'], sort: (i) => i.segment, render: (i) => i.segment },
  { key: 'region', label: 'Region', groups: ['core', 'classification', 'funding'], sort: (i) => i.region, render: (i) => <span className="num">{i.region}</span> },
  { key: 'subregion', label: 'Subregion', groups: ['classification'], sort: (i) => i.subregion, render: (i) => <span className="whitespace-nowrap">{i.subregion}</span> },
  { key: 'owner', label: 'Owner', groups: ['funding'], sort: (i) => i.owner, render: (i) => <span className="whitespace-nowrap">{i.owner}</span> },
  { key: 'partner', label: 'Partner', groups: ['funding'], sort: (i) => i.partner ?? '', render: (i) => i.partner ?? <span className="text-mute">—</span> },
  { key: 'source', label: 'Budget source', groups: ['funding'], sort: (i) => sourceLabel(i), render: (i) => <span className="text-[12px]">{sourceLabel(i)}</span> },
  { key: 'requested', label: 'Requested', groups: ['core', 'funding'], align: 'right', sort: (i) => i.requestedInvestment, render: (i) => <span className="num">{money(i.requestedInvestment)}</span> },
  {
    key: 'approved',
    label: 'Approved',
    groups: ['core', 'funding'],
    align: 'right',
    sort: (i) => i.approvedInvestment,
    render: (i) => <span className="num">{i.approvalStatus === 'Approved' ? money(i.approvedInvestment) : <span className="text-mute">—</span>}</span>,
  },
  { key: 'mqls', label: 'Exp. MQLs', groups: ['core', 'outcomes'], align: 'right', sort: (i) => i.expected.mqls, render: (i) => <span className="num">{count(i.expected.mqls)}</span> },
  { key: 'pipe', label: 'Exp. new pipeline', groups: ['core', 'outcomes'], align: 'right', sort: (i) => i.expected.newPipeline, render: (i) => <span className="num">{moneyShort(i.expected.newPipeline)}</span> },
  { key: 'infl', label: 'Exp. influenced', groups: ['outcomes'], align: 'right', sort: (i) => i.expected.influencedPipeline, render: (i) => <span className="num">{moneyShort(i.expected.influencedPipeline)}</span> },
  { key: 'dr', label: 'Exp. deal regs', groups: ['outcomes'], align: 'right', sort: (i) => i.expected.dealRegistrations, render: (i) => <span className="num">{i.expected.dealRegistrations || '—'}</span> },
  { key: 'drv', label: 'Exp. deal reg value', groups: ['outcomes'], align: 'right', sort: (i) => i.expected.dealRegValue, render: (i) => <span className="num">{i.expected.dealRegValue ? moneyShort(i.expected.dealRegValue) : '—'}</span> },
];

const STATUS_FILTERS: ('All' | ApprovalStatus)[] = ['All', 'Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected'];

export function Register() {
  const { initiatives, filters, openInitiative } = useStore();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | ApprovalStatus>('All');
  const [group, setGroup] = useState<Group>('core');
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: 'id', dir: 1 });

  const rows = useMemo(() => {
    let r = searchInitiatives(filterInitiatives(initiatives, filters), query);
    if (status !== 'All') r = r.filter((i) => i.approvalStatus === status);
    const col = COLUMNS.find((c) => c.key === sort.key);
    const acc = sort.key === 'name' ? (i: Initiative) => i.name : col ? col.sort : (i: Initiative) => i.id;
    return [...r].sort((a, b) => {
      const x = acc(a);
      const y = acc(b);
      return (x < y ? -1 : x > y ? 1 : a.id.localeCompare(b.id)) * sort.dir;
    });
  }, [initiatives, filters, query, status, sort]);

  const cols = COLUMNS.filter((c) => c.groups.includes(group));
  const totals = sumSpend(rows);
  const pipe = rows.reduce((s, i) => s + i.expected.newPipeline, 0);

  const header = (key: string, label: string, align?: 'right') => {
    const active = sort.key === key;
    return (
      <th key={key} className={align === 'right' ? 'text-right' : ''} aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}>
        <button
          className={`inline-flex items-center gap-1 uppercase hover:text-ink ${active ? 'text-ink' : ''}`}
          onClick={() => setSort({ key, dir: active ? (sort.dir === 1 ? -1 : 1) : align === 'right' ? -1 : 1 })}
        >
          {label}
          {active && (sort.dir === 1 ? <LuArrowUp /> : <LuArrowDown />)}
        </button>
      </th>
    );
  };

  return (
    <>
      <ViewHeader
        index="02"
        title="Global initiative plan"
        lede="The master register every region plans in. One row per initiative, one shared taxonomy — so investment, objectives and expected outcomes can be compared across the world. Select any row for the full record."
      />
      <FilterBar
        extra={
          <label className="flex-1 min-w-[140px] max-w-[200px]">
            <span className="eyebrow block mb-1">Approval status</span>
            <select className={`select ${status !== 'All' ? '!border-ink !bg-lime' : ''}`} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        }
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-6">
        <label className="relative w-full lg:max-w-md">
          <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
          <input
            className="field !pl-9 !h-11"
            placeholder="Search name, ID, owner, partner, subregion…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search initiatives"
          />
        </label>
        <div className="hidden md:flex border border-ink" role="tablist" aria-label="Column set">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={group === g.id}
              onClick={() => setGroup(g.id)}
              className={`px-3 lg:px-4 h-10 font-mono text-[11px] uppercase tracking-[0.06em] border-r border-ink last:border-r-0 ${
                group === g.id ? 'bg-ink text-white' : 'hover:bg-white'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-2 pb-4 text-[13px]">
        <span>
          <span className="num font-medium">{rows.length}</span> <span className="text-mute">initiatives</span>
        </span>
        <span>
          <span className="num font-medium">{moneyShort(totals.proposed)}</span> <span className="text-mute">proposed</span>
        </span>
        <span>
          <span className="num font-medium">{moneyShort(totals.approved)}</span> <span className="text-mute">approved</span>
        </span>
        <span>
          <span className="num font-medium">{moneyShort(pipe)}</span> <span className="text-mute">expected new pipeline (all statuses)</span>
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>No initiatives match these filters.</Empty>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto border-t border-ink max-h-[70vh] overflow-y-auto">
            <table className="tbl">
              <thead>
                <tr>
                  {header('id', 'ID')}
                  {header('name', 'Initiative')}
                  {cols.map((c) => header(c.key, c.label, c.align))}
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr
                    key={i.id}
                    className="clickable"
                    tabIndex={0}
                    onClick={() => openInitiative(i.id)}
                    onKeyDown={(e) => e.key === 'Enter' && openInitiative(i.id)}
                  >
                    <td className="num text-[12px] text-mute whitespace-nowrap">{i.id}</td>
                    <td className="min-w-[260px] max-w-[380px]">
                      <div className="font-medium leading-snug">{i.name}</div>
                      <div className="text-[12px] text-mute line-clamp-1 mt-0.5">{i.description}</div>
                    </td>
                    {cols.map((c) => (
                      <td key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                        {c.render(i)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="md:hidden border-t border-ink">
            {rows.map((i) => (
              <li key={i.id}>
                <button className="w-full text-left py-4 border-b border-line flex gap-3 items-start" onClick={() => openInitiative(i.id)}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="num text-[11px] text-mute">{i.id}</span>
                      <StageChip initiative={i} />
                    </div>
                    <div className="font-medium leading-snug">{i.name}</div>
                    <div className="text-[12px] text-mute mt-1">
                      {i.category} · {REGION_LABEL[i.region]} · {i.quarter}
                    </div>
                    <div className="flex gap-4 mt-2 num text-[12px]">
                      <span>{moneyShort(i.requestedInvestment)} req.</span>
                      <span>{moneyShort(i.expected.newPipeline)} pipe</span>
                      <span>{i.expected.mqls} MQLs</span>
                    </div>
                  </div>
                  <LuChevronRight className="mt-6 text-mute shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
