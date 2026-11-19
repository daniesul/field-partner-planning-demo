import type { ReactNode } from 'react';
import { LuCompass, LuRotateCcw } from 'react-icons/lu';
import { useStore } from '../state/store';
import { isPending } from '../lib/calculations';
import { useTour } from '../tour/Tour';

export type Route = 'overview' | 'initiatives' | 'approvals' | 'budget' | 'pipeline';

export const ROUTES: { id: Route; num: string; label: string; short: string }[] = [
  { id: 'overview', num: '01', label: 'Overview', short: 'Overview' },
  { id: 'initiatives', num: '02', label: 'Initiative Plan', short: 'Initiatives' },
  { id: 'approvals', num: '03', label: 'Approvals', short: 'Approvals' },
  { id: 'budget', num: '04', label: 'Budget', short: 'Budget' },
  { id: 'pipeline', num: '05', label: 'Pipeline Planning', short: 'Pipeline' },
];

export function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const { reset, isModified, initiatives } = useStore();
  const { start } = useTour();
  const queue = initiatives.filter((i) => isPending(i) && i.approvalStatus !== 'Draft').length;
  return (
    <div className="min-h-screen [--nav-h:88px] md:[--nav-h:96px]">
      <header className="sticky top-0 z-30 bg-paper">
        <div className="h-8 bg-ink text-white flex items-center gap-4 px-4 md:px-6 lg:px-10">
          <a
            href="#overview"
            className="hidden lg:block shrink-0 font-display font-extrabold uppercase text-[13px] tracking-[0.02em] hover:underline underline-offset-4"
          >
            Field &amp; Partner Planning
          </a>
          <div className="flex-1 min-w-0 flex items-center lg:justify-center gap-3">
            <span className="w-1.5 h-1.5 bg-lime rounded-full shrink-0" aria-hidden />
            <span className="font-mono text-[10.5px] md:text-[11px] tracking-[0.18em] uppercase whitespace-nowrap overflow-hidden text-ellipsis">
              Portfolio demonstration — synthetic data
            </span>
          </div>
          <div className="shrink-0 flex items-center h-full -mr-2 md:-mr-3">
            <button
              onClick={() => start('button')}
              className="h-full flex items-center gap-2 px-2 md:px-3 font-mono text-[10.5px] md:text-[11px] uppercase tracking-[0.12em] hover:bg-white/15 transition-colors"
              title="Take a short guided tour"
              aria-label="Guided tour"
            >
              <LuCompass aria-hidden className="text-[14px]" />
              <span className="hidden sm:inline">Guided tour</span>
            </button>
            <button
              onClick={reset}
              className={`h-full flex items-center gap-2 px-2 md:px-3 font-mono text-[10.5px] md:text-[11px] uppercase tracking-[0.12em] transition-colors ${
                isModified ? 'bg-lime text-ink hover:bg-lime-deep' : 'hover:bg-white/15'
              }`}
              title="Restore the original demo data"
              aria-label="Reset demo"
            >
              <LuRotateCcw aria-hidden className="text-[14px]" />
              <span className="hidden sm:inline">Reset demo</span>
            </button>
          </div>
        </div>
        <nav data-tour="nav" className="h-14 md:h-16 border-b border-ink flex items-stretch" aria-label="Primary">
          <div className="flex-1 flex overflow-x-auto no-scrollbar">
            {ROUTES.map((r) => {
              const active = r.id === route;
              return (
                <a
                  key={r.id}
                  href={`#${r.id}`}
                  aria-current={active ? 'page' : undefined}
                  className={`group relative flex items-center justify-center gap-2 px-4 md:flex-1 border-r border-line shrink-0 whitespace-nowrap transition-colors ${
                    active ? 'bg-ink text-white' : 'hover:bg-white'
                  }`}
                >
                  <span className={`font-mono text-[10.5px] ${active ? 'text-lime' : 'text-mute'}`}>{r.num}</span>
                  <span className="font-display font-bold uppercase text-[13px] lg:text-[14px] tracking-[0.02em]">
                    <span className="xl:hidden">{r.short}</span>
                    <span className="hidden xl:inline">{r.label}</span>
                  </span>
                  {r.id === 'approvals' && queue > 0 && (
                    <span className={`num text-[10px] px-1.5 py-px ${active ? 'bg-lime text-ink' : 'bg-ink text-white'}`}>{queue}</span>
                  )}
                </a>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="px-5 md:px-10 max-w-[1600px] mx-auto">{children}</main>
      <footer className="mt-16 border-t border-ink">
        <div className="px-5 md:px-10 max-w-[1600px] mx-auto py-10 grid gap-6 md:grid-cols-[1fr_auto] items-end">
          <div>
            <div className="display text-[40px] md:text-[64px]">Field &amp; Partner Planning</div>
            <p className="text-[13px] text-mute max-w-2xl mt-3 leading-relaxed">
              A portfolio visualization of a global field &amp; partner marketing planning framework. The methodology and operating model are
              original work; every initiative, partner, person, budget, target and pipeline figure shown here is fictional. Changes you make
              live only in this browser tab and reset on reload.
            </p>
          </div>
          <div className="eyebrow">React · TypeScript · Vite · Tailwind</div>
        </div>
      </footer>
    </div>
  );
}
