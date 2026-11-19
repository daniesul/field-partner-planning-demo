import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { loadInitialDataset } from '../data';
import {
  applyFinance,
  applyWorkflow,
  pipelineCell,
  sumSpend,
  type FinancePatch,
  type ValidationResult,
  type WorkflowAction,
} from '../lib/calculations';
import { moneyShort, pct } from '../lib/format';
import { track } from '../tour/analytics';
import type { Dataset, Filters, Initiative } from '../types/models';
import { EMPTY_FILTERS, REGION_LABEL } from '../types/models';

export interface ActivityEntry {
  id: number;
  initiativeId: string;
  title: string;
  detail: string;
  kind: 'approve' | 'reject' | 'workflow' | 'finance';
}

interface Store {
  dataset: Dataset;
  initiatives: Initiative[];
  filters: Filters;
  setFilters: (f: Partial<Filters>) => void;
  clearFilters: () => void;
  selectedId: string | null;
  openInitiative: (id: string | null) => void;
  decide: (id: string, action: WorkflowAction) => void;
  updateFinance: (id: string, patch: FinancePatch) => ValidationResult;
  reset: () => void;
  activity: ActivityEntry[];
  isModified: boolean;
}

const Ctx = createContext<Store | null>(null);
let seq = 0;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset>(loadInitialDataset);
  const [filters, setFiltersState] = useState<Filters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);

  const log = useCallback((e: Omit<ActivityEntry, 'id'>) => setActivity((a) => [{ ...e, id: ++seq }, ...a].slice(0, 30)), []);

  const decide = useCallback(
    (id: string, action: WorkflowAction) => {
      const before = dataset.initiatives;
      const target = before.find((i) => i.id === id);
      if (!target) return;
      track('demo_decision', { section_name: action, item_name: target.name });
      const after = applyWorkflow(before, id, action);
      const scope: Filters = { ...EMPTY_FILTERS, region: target.region, quarter: target.quarter };
      const b = pipelineCell(dataset, before, scope);
      const a = pipelineCell(dataset, after, scope);
      const where = `${REGION_LABEL[target.region]} ${target.quarter}`;
      if (action === 'approve') {
        const invB = sumSpend(before.filter((i) => i.region === target.region && i.quarter === target.quarter)).approved;
        const invA = sumSpend(after.filter((i) => i.region === target.region && i.quarter === target.quarter)).approved;
        log({
          initiativeId: id,
          kind: 'approve',
          title: `Approved · ${target.name}`,
          detail: `${where} forecast ${moneyShort(b.approvedPipeline)} → ${moneyShort(a.approvedPipeline)} (${pct(b.coverage)} → ${pct(a.coverage)} of target). Gap ${moneyShort(b.gap)} → ${moneyShort(a.gap)}. Approved investment ${moneyShort(invB)} → ${moneyShort(invA)}.`,
        });
      } else if (action === 'reject') {
        log({
          initiativeId: id,
          kind: 'reject',
          title: `Rejected · ${target.name}`,
          detail: `${moneyShort(target.requestedInvestment)} request and ${moneyShort(target.expected.newPipeline)} of proposed pipeline removed from ${where} planning. Committed forecast unchanged at ${moneyShort(a.approvedPipeline)}.`,
        });
      } else {
        const label = action === 'submit' ? 'Submitted' : action === 'review' ? 'Moved to review' : 'Reopened';
        log({ initiativeId: id, kind: 'workflow', title: `${label} · ${target.name}`, detail: `${target.id} is now ${after.find((i) => i.id === id)!.approvalStatus}.` });
      }
      setDataset((d) => ({ ...d, initiatives: after }));
    },
    [dataset, log],
  );

  const updateFinance = useCallback(
    (id: string, patch: FinancePatch) => {
      const { list, result } = applyFinance(dataset.initiatives, id, patch);
      if (result.ok) {
        const t = list.find((i) => i.id === id)!;
        const v = t.finance.actualSpend !== null ? t.approvedInvestment - t.finance.actualSpend : null;
        log({
          initiativeId: id,
          kind: 'finance',
          title: `Finance updated · ${t.name}`,
          detail:
            v === null
              ? `Status ${t.finance.status}${t.finance.poNumber ? ` · ${t.finance.poNumber}` : ''}.`
              : `Actual ${moneyShort(t.finance.actualSpend)} vs approved ${moneyShort(t.approvedInvestment)} — ${v >= 0 ? `${moneyShort(v)} released to budget` : `${moneyShort(-v)} overspend`}.`,
        });
        setDataset((d) => ({ ...d, initiatives: list }));
      }
      return result;
    },
    [dataset, log],
  );

  const reset = useCallback(() => {
    setDataset(loadInitialDataset());
    setFiltersState(EMPTY_FILTERS);
    setSelectedId(null);
    setActivity([]);
  }, []);

  const value = useMemo<Store>(
    () => ({
      dataset,
      initiatives: dataset.initiatives,
      filters,
      setFilters: (f) => setFiltersState((cur) => ({ ...cur, ...f })),
      clearFilters: () => setFiltersState(EMPTY_FILTERS),
      selectedId,
      openInitiative: setSelectedId,
      decide,
      updateFinance,
      reset,
      activity,
      isModified: activity.length > 0,
    }),
    [dataset, filters, selectedId, decide, updateFinance, reset, activity],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}
