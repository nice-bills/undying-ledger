// SPDX-License-Identifier: Apache-2.0
// Undying Ledger, "the cash box". Six beats of the demo story, all driven by the real compiled
// Compact circuits through DemoEngine (compact-runtime in this browser). Only the presentation
// is new; engine.ts, fees.ts and the contract are the same logic the tests exercise.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { DemoEngine } from './demo/engine';
import { bootEngine } from './demo/boot';
import { RM } from './a2/motion';
import { push } from './box/motion';
import { MeetingBeat } from './beats/MeetingBeat';
import { PassbookBeat } from './beats/PassbookBeat';
import { HusbandBeat } from './beats/HusbandBeat';
import { SunsetBeat } from './beats/SunsetBeat';
import { Meeting13Beat } from './beats/Meeting13Beat';
import { ProveBeat } from './beats/ProveBeat';
import { FeeKeyPage } from './pages/FeeKeyPage';
import { LegalPage } from './pages/LegalPage';
import type { BeatProps } from './beats/types';
import { PREPROD_RUN } from './demo/preprod';

// Preprod live mode ships Midnight.js; load it only when someone opens #/live.
const LivePage = lazy(() => import('./lace/LivePage'));

export const LABELS = [
  'Secretary records meeting 12',
  'Ama’s private passbook',
  'Her husband’s phone sees nothing',
  'Grant ends, anyone calls sunset',
  'Meeting 13 still records',
  'Prove savings, keep the amount',
];

const BEATS: { C: (p: BeatProps) => React.ReactElement; world: string }[] = [
  { C: MeetingBeat, world: 'w-green' },
  { C: PassbookBeat, world: 'w-green' },
  { C: HusbandBeat, world: 'w-slate' },
  { C: SunsetBeat, world: 'w-green w-dusk' },
  { C: Meeting13Beat, world: 'w-green' },
  { C: ProveBeat, world: 'w-saf' },
];

const noSub = () => () => undefined;
const zero = () => 0;

/** Start building the demo book now (the landing calls this while the visitor reads). */
export const prewarm = () => void bootEngine();

/**
 * The demo book (demo/boot.ts): deploy, then the 11 earlier meetings one per task through the real
 * circuits, after the first paint. If the landing already built it, it is ready at once.
 */
function useEngine(): { engine: DemoEngine | null; seeded: number } {
  const b = bootEngine();
  const [engine, setEngine] = useState<DemoEngine | null>(() => (b.done ? b.engine : null));
  const [seeded, setSeeded] = useState(b.seeded);
  useEffect(() => {
    let gone = false;
    const f = (n: number) => !gone && setSeeded(n);
    b.listeners.add(f);
    b.ready.then((e) => !gone && setEngine(e));
    return () => {
      gone = true;
      b.listeners.delete(f);
    };
  }, [b]);
  useSyncExternalStore(engine?.subscribe ?? noSub, engine?.getVersion ?? zero);
  useEffect(() => {
    if (!engine) return;
    // the demo clock: one real second is one second of block time; the vendor's server heartbeats while it is online
    const id = setInterval(() => engine.tick(1), 1000);
    return () => clearInterval(id);
  }, [engine]);
  return { engine, seeded };
}

/** What shows while the book is being built: the first screen's shape, and how far along it is. */
function Opening({ seeded }: { seeded: number }) {
  return (
    <section className="beat w-green" data-testid="opening" aria-busy="true" aria-label="Opening the group’s book">
      <div className="screen">
        <header className="top">
          <div>
            <div className="who">
              <b>Fuseina</b>, secretary
            </div>
            <div className="where">Kpalsi Women’s Group</div>
          </div>
        </header>
        <h1 className="h1">Meeting 12</h1>
        <div className="proving on" role="status">
          <div className="row">
            <span>Opening the group’s book</span>
            <b className="num">{seeded} of 11</b>
          </div>
          <span className="skel" style={{ width: '90%', height: 64 }} />
          <span className="skel" style={{ width: '70%' }} />
          <span className="skel" style={{ width: '82%' }} />
          <p className="note">Replaying the 11 earlier meetings through the real circuits on this phone.</p>
        </div>
      </div>
    </section>
  );
}

function useHashRoute(): string {
  const [h, setH] = useState(() => location.hash);
  useEffect(() => {
    const f = () => setH(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return h.replace(/^#\/?/, '').split('?')[0];
}

export default function App() {
  const { engine: e, seeded } = useEngine();
  const route = useHashRoute();
  const [cur, setCur] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);
  const turning = useRef(false);
  const pending = useRef<number | null>(null); // a tap that lands mid-turn is kept, not dropped
  const sections = useRef<(HTMLElement | null)[]>([]);
  const live = useRef<HTMLDivElement>(null);

  const announce = useCallback((msg: string) => {
    const l = live.current;
    if (!l) return;
    l.textContent = '';
    setTimeout(() => (l.textContent = msg), 30);
  }, []);

  const go = useCallback(
    (n: number) => {
      if (n < 0 || n >= BEATS.length) return;
      if (turning.current) {
        pending.current = n;
        return;
      }
      if (n === cur) return;
      turning.current = true;
      setPrev(cur);
      setCur(n);
    },
    [cur],
  );

  useLayoutEffect(() => {
    if (prev === null) return;
    const a = sections.current[prev];
    const b = sections.current[cur];
    if (b) b.scrollTop = 0;
    let gone = false;
    (a && b && !RM ? push(a, b, cur > prev ? 1 : -1) : Promise.resolve()).then(() => {
      if (gone) return;
      turning.current = false;
      setPrev(null);
      b?.querySelector<HTMLElement>('h1,h2')?.focus({ preventScroll: true });
      const n = pending.current;
      pending.current = null;
      if (n !== null && n !== cur) {
        turning.current = true;
        setPrev(cur);
        setCur(n);
      }
    });
    return () => {
      gone = true;
      turning.current = false;
    };
  }, [cur, prev]);

  // make sure a reload with a sub-page hash still lands on a readable page
  useEffect(() => {
    document.title = route === 'terms' ? 'Terms · Undying Ledger' : route === 'privacy' ? 'Privacy · Undying Ledger' : 'Undying Ledger · Midnight';
  }, [route]);

  const page =
    route === 'terms' || route === 'privacy' ? (
      <LegalPage which={route} />
    ) : route === 'fee-key' ? (
      e ? <FeeKeyPage e={e} /> : <Opening seeded={seeded} />
    ) : route === 'live' ? (
      <Suspense fallback={<p className="boot">Opening the live register…</p>}>
        <LivePage />
      </Suspense>
    ) : null;

  return (
    <div id="app">
      <div id="live" className="vh" aria-live="polite" ref={live} />
      {!e && !page && <Opening seeded={seeded} />}
      <div hidden={!!page || !e}>
        {e && BEATS.map(({ C, world }, i) => (
          <section
            key={i}
            className={`beat ${world}`}
            data-b={i}
            data-testid={`beat-${i}`}
            aria-label={LABELS[i]}
            hidden={!(i === cur || i === prev)}
            ref={(n) => {
              sections.current[i] = n;
            }}
          >
            <C e={e} active={i === cur && prev === null && !page} go={go} announce={announce} />
          </section>
        ))}
        <nav className="rail" aria-label="Demo steps">
          <div className="rail-head">
            <button type="button" className="rail-nav" onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="Previous step">
              Back
            </button>
            <p className="rail-label">
              <span className="num">
                Step {cur + 1} of {LABELS.length}
              </span>
              <b>{LABELS[cur]}</b>
            </p>
            <button type="button" className="rail-nav" onClick={() => go(cur + 1)} disabled={cur === LABELS.length - 1} aria-label="Next step">
              Next
            </button>
          </div>
          {/* where you are in the story; each part also jumps to its step */}
          <ol className="rail-steps">
            {LABELS.map((l, i) => (
              <li key={i}>
                <button type="button" aria-label={`Step ${i + 1}: ${l}`} aria-current={i === cur ? 'step' : 'false'} data-done={i < cur ? '' : undefined} onClick={() => go(i)}>
                  <i aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
          <div className="foot">
            <span>
              Simulator: real circuits, no wallet
              {PREPROD_RUN && (
                <>
                  {'. '}
                  <a href="#/live">Ran on Preprod</a>
                </>
              )}
            </span>
            <span className="legal">
              <a href="#/fee-key">Fee key</a>
              <a href="#/terms">Terms</a>
              <a href="#/privacy">Privacy</a>
            </span>
          </div>
        </nav>
      </div>
      {page}
    </div>
  );
}
