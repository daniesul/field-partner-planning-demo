import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { LuArrowLeft, LuArrowRight, LuX } from 'react-icons/lu';
import { useStore } from '../state/store';
import { track } from './analytics';
import { STEPS } from './steps';

/*
 * Guided tour: an optional, skippable walkthrough of the demo.
 *  - A small card invites the visitor once per session; a header button restarts it any time.
 *  - Each step navigates to its view, spotlights one element and explains it.
 *  - One step waits for the visitor to make a real decision, so the tour is a clickable demo.
 * No dependencies. The script lives in ./steps.ts.
 */

type StartSource = 'invite' | 'button';

interface TourApi {
  start: (source: StartSource) => void;
  active: boolean;
}

const Ctx = createContext<TourApi | null>(null);

export function useTour(): TourApi {
  const t = useContext(Ctx);
  if (!t) throw new Error('useTour must be used inside <TourProvider>');
  return t;
}

const FLAG = 'fp-tour';
function readFlag(): string | null {
  try {
    return window.sessionStorage.getItem(FLAG);
  } catch {
    return null;
  }
}
function writeFlag(value: string): void {
  try {
    window.sessionStorage.setItem(FLAG, value);
  } catch {
    /* storage can be unavailable; the invite just shows again next load */
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { reset } = useStore();
  const [index, setIndex] = useState<number | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  // Offer the tour once per session, shortly after the page loads.
  useEffect(() => {
    if (readFlag()) return undefined;
    const t = window.setTimeout(() => {
      setInviteOpen(true);
      track('tour_invite_shown');
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  const start = useCallback(
    (source: StartSource) => {
      reset(); // a known starting point: original data, no filters
      writeFlag('taken');
      setInviteOpen(false);
      setIndex(0);
      track('tour_start', { tour_source: source });
    },
    [reset],
  );

  const decline = useCallback(() => {
    writeFlag('declined');
    setInviteOpen(false);
    track('tour_decline');
  }, []);

  const close = useCallback((completed: boolean, at: number) => {
    if (completed) {
      writeFlag('done');
      track('tour_complete');
    } else {
      track('tour_skip', { step_index: at + 1, step_id: STEPS[at]?.id ?? 'unknown' });
    }
    setIndex(null);
  }, []);

  const value = useMemo<TourApi>(() => ({ start, active: index !== null }), [start, index]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {inviteOpen && index === null && <TourInvite onAccept={() => start('invite')} onDecline={decline} />}
      {index !== null && <TourOverlay index={index} setIndex={setIndex} onClose={close} />}
    </Ctx.Provider>
  );
}

// ─────────────────────────────────────────────── invite

function TourInvite({ onAccept, onDecline }: { onAccept: () => void; onDecline: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDecline();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDecline]);

  return (
    <div
      role="dialog"
      aria-labelledby="tour-invite-title"
      aria-describedby="tour-invite-body"
      className="fixed z-[60] inset-x-3 bottom-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] bg-white border border-ink p-5 md:p-6 anim-fade shadow-[6px_6px_0_0_var(--color-ink)]"
    >
      <div className="eyebrow !text-ink mb-3">Guided tour · about 2 minutes</div>
      <h2 id="tour-invite-title" className="display text-[28px]">
        Lots going on here
      </h2>
      <p id="tour-invite-body" className="text-[14px] leading-relaxed text-[#3a3a3a] mt-3">
        Want a short walkthrough of what each view does and how they connect? Or explore on your own.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="btn-solid" onClick={onAccept}>
          Take the tour
        </button>
        <button className="btn-ghost" onClick={onDecline}>
          Explore on my own
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────── overlay

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 8;
const GAP = 14;
const EDGE = 12;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(n, hi));

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Scrolls so the target sits just below the sticky header and filter bar, unless it is already fully visible. */
function bringIntoView(el: Element): void {
  const header = document.querySelector('header');
  if (header && header.contains(el)) return; // the nav is always on screen
  const filters = document.querySelector('[data-tour="filters"]');
  const isFilters = !!filters && (filters === el || filters.contains(el));
  const stickyTop = (header ? header.getBoundingClientRect().height : 0) + (filters && !isFilters ? filters.getBoundingClientRect().height : 0);
  const margin = 16;
  const r = el.getBoundingClientRect();
  const visible = r.top >= stickyTop + margin - 1 && r.bottom <= window.innerHeight - margin;
  if (visible) return;
  window.scrollTo({ top: Math.max(0, window.scrollY + r.top - stickyTop - margin), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

function TourOverlay({
  index,
  setIndex,
  onClose,
}: {
  index: number;
  setIndex: (n: number) => void;
  onClose: (completed: boolean, at: number) => void;
}) {
  const { activity, clearFilters } = useStore();
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;
  const interactive = step.waitFor === 'decision';
  /** Steps that ask the visitor to do something leave the page behind the spotlight clickable. */
  const handsOn = interactive || !!step.tryIt;

  const [rect, setRect] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [size, setSize] = useState({ w: 360, h: 240 });
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  const popRef = useRef<HTMLDivElement>(null);

  // Decisions made after the step opened are what the interactive step waits for.
  const activityLen = useRef(activity.length);
  activityLen.current = activity.length;
  const baseline = useRef(activity.length);
  // The store hands out a new clearFilters function on every state change; keep the latest without re-running the step effect.
  const clearRef = useRef(clearFilters);
  clearRef.current = clearFilters;

  // Enter a step: go to its view, find its target, bring it on screen, keep the spotlight on it.
  useEffect(() => {
    let cancelled = false;
    let el: Element | null = null;
    let raf = 0;
    const selector = step.target;

    baseline.current = activityLen.current;
    setMissing(false);
    track('tour_step', { step_index: index + 1, step_id: step.id });
    if (step.id !== 'filters') clearRef.current(); // the filters step is the one place the visitor changes them

    const here = window.location.hash.replace(/^#\/?/, '') || 'overview';
    if (here !== step.route) {
      // The app smooth-scrolls to the top on every view change. Jump there first so that animation has nothing
      // left to do and can't overrule (or fool) the scroll that brings this step's target into view.
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.location.hash = `#${step.route}`;
    }

    const measure = () => {
      if (!selector) return;
      if (!el || !el.isConnected) el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      setVp({ w: window.innerWidth, h: window.innerHeight });
    };
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    let timer = 0;
    const settle: number[] = [];
    if (!selector) {
      setRect(null);
    } else {
      let tries = 0;
      timer = window.setInterval(() => {
        if (cancelled) return;
        tries += 1;
        const found = document.querySelector(selector);
        if (found) {
          window.clearInterval(timer);
          el = found;
          bringIntoView(found);
          measure();
          // Re-measure once the view and any smooth scrolling have settled.
          settle.push(window.setTimeout(schedule, 150), window.setTimeout(schedule, 450));
        } else if (tries > 40) {
          window.clearInterval(timer);
          setRect(null);
          setMissing(true);
        }
      }, 60);
    }

    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(document.body);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      settle.forEach((t) => window.clearTimeout(t));
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [index]);

  // The interactive step moves on by itself once a decision is recorded.
  const decided = interactive && activity.length > baseline.current && activity[0] !== undefined && (activity[0].kind === 'approve' || activity[0].kind === 'reject');
  useEffect(() => {
    if (!decided) return undefined;
    const t = window.setTimeout(() => setIndex(index + 1), 900);
    return () => window.clearTimeout(t);
  }, [decided, index, setIndex]);

  // Escape ends the tour from anywhere on the page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false, index);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, onClose]);

  const centered = !step.target || missing || !rect;
  const ready = centered ? !step.target || missing : true;

  // Measure the card so it can be placed without covering the spotlight.
  useLayoutEffect(() => {
    const el = popRef.current;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  });

  // Move keyboard focus to the card when a step appears.
  useEffect(() => {
    if (ready) popRef.current?.focus({ preventScroll: true });
  }, [index, ready]);

  const mobile = vp.w < 640;
  let style: CSSProperties;
  if (mobile) {
    style = { left: EDGE, right: EDGE, bottom: EDGE };
  } else if (centered || !rect) {
    style = { left: Math.max(EDGE, (vp.w - size.w) / 2), top: Math.max(EDGE, (vp.h - size.h) / 2) };
  } else {
    const hole = { top: rect.top - PAD, left: rect.left - PAD, right: rect.left + rect.width + PAD, bottom: rect.top + rect.height + PAD };
    const maxLeft = vp.w - size.w - EDGE;
    const maxTop = vp.h - size.h - EDGE;
    if (hole.bottom + GAP + size.h <= vp.h - EDGE) {
      style = { top: hole.bottom + GAP, left: clamp(hole.left, EDGE, maxLeft) };
    } else if (hole.top - GAP - size.h >= EDGE) {
      style = { top: hole.top - GAP - size.h, left: clamp(hole.left, EDGE, maxLeft) };
    } else if (hole.right + GAP + size.w <= vp.w - EDGE) {
      style = { left: hole.right + GAP, top: clamp(hole.top, EDGE, maxTop) };
    } else if (hole.left - GAP - size.w >= EDGE) {
      style = { left: hole.left - GAP - size.w, top: clamp(hole.top, EDGE, maxTop) };
    } else {
      style = { left: Math.max(EDGE, maxLeft), top: Math.max(EDGE, maxTop) }; // no room: dock in the corner
    }
  }
  if (!ready) style = { ...style, visibility: 'hidden' };

  // Keep Tab inside the card on steps that don't need the page behind it.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || handsOn) return;
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'));
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === e.currentTarget)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const next = () => (isLast ? onClose(true, index) : setIndex(index + 1));
  const waiting = interactive && !decided;

  return (
    <>
      {!handsOn && <div className="fixed inset-0 z-[59]" aria-hidden />}
      {centered ? (
        <div className="fixed inset-0 z-[60] bg-ink/60 pointer-events-none" aria-hidden />
      ) : (
        <div
          className="tour-hole fixed z-[60] pointer-events-none"
          aria-hidden
          style={{
            top: rect!.top - PAD,
            left: rect!.left - PAD,
            width: rect!.width + PAD * 2,
            height: rect!.height + PAD * 2,
            outline: '3px solid var(--color-lime)',
            boxShadow: '0 0 0 9999px rgba(17, 17, 17, 0.62)',
          }}
        />
      )}
      <div
        ref={popRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="tour-pop fixed z-[70] w-[min(360px,calc(100vw-24px))] max-sm:w-auto bg-white border border-ink outline-none shadow-[6px_6px_0_0_var(--color-ink)]"
        style={style}
      >
        <div className="px-5 pt-4 flex items-center justify-between gap-3">
          <span className="eyebrow !text-ink">
            Step {index + 1} / {STEPS.length}
          </span>
          <button className="p-1 -mr-1 hover:bg-paper" aria-label="End tour" onClick={() => onClose(false, index)}>
            <LuX aria-hidden />
          </button>
        </div>
        <div className="flex gap-1 px-5 mt-3" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.id} className={`h-1 flex-1 ${i <= index ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </div>
        <div className="px-5 pt-4 pb-5">
          <h2 id="tour-title" className="display text-[24px]">
            {step.title}
          </h2>
          <p id="tour-body" className="text-[14px] leading-relaxed text-[#3a3a3a] mt-3">
            {step.body}
          </p>
          {step.tryIt && !missing && (
            <p className="mt-3 border border-ink bg-lime px-3 py-2 text-[13px] leading-snug">
              <strong className="font-mono uppercase text-[10.5px] tracking-[0.08em] mr-2">Try it</strong>
              {step.tryIt}
            </p>
          )}
          {waiting && (
            <p className="num text-[12px] text-mute mt-3" role="status">
              {missing ? step.fallback : 'Waiting for your decision…'}
            </p>
          )}
          {decided && (
            <p className="num text-[12px] text-mute mt-3" role="status">
              Decision recorded. Moving on…
            </p>
          )}
          {step.link && (
            <a
              href={step.link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 font-mono text-[11px] uppercase tracking-[0.08em] underline underline-offset-4 hover:no-underline"
            >
              {step.link.label}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-line">
          <button className="btn-ghost btn-sm" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            <LuArrowLeft aria-hidden /> Back
          </button>
          <button className={`${waiting ? 'btn-ghost' : 'btn-solid'} btn-sm ml-auto`} onClick={next} disabled={decided}>
            {waiting ? 'Skip step' : isLast ? 'Finish' : 'Next'}
            {!isLast && <LuArrowRight aria-hidden />}
          </button>
        </div>
      </div>
    </>
  );
}
