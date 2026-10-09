// SPDX-License-Identifier: Apache-2.0
// Undying Ledger, "A2 Passbook". Six beats of the demo story, all driven by the real compiled
// Compact circuits through DemoEngine (compact-runtime in this browser). Only the presentation
// is new; engine.ts, fees.ts and the contract are the same logic the tests exercise.
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DemoEngine } from './demo/engine';
import { InkDefs } from './a2/paper';
import { pageTurn, RM } from './a2/motion';
import { MeetingBeat } from './beats/MeetingBeat';
import { PassbookBeat } from './beats/PassbookBeat';
import { HusbandBeat } from './beats/HusbandBeat';
import { SunsetBeat } from './beats/SunsetBeat';
import { Meeting13Beat } from './beats/Meeting13Beat';
import { ProveBeat } from './beats/ProveBeat';
import { FeeKeyPage } from './pages/FeeKeyPage';
import { LegalPage } from './pages/LegalPage';
import type { BeatProps } from './beats/types';

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
  { C: PassbookBeat, world: 'w-ox' },
  { C: HusbandBeat, world: 'w-slate' },
  { C: SunsetBeat, world: 'w-green' },
  { C: Meeting13Beat, world: 'w-green' },
  { C: ProveBeat, world: 'w-ox' },
];

function useEngine(): DemoEngine {
  const engine = useMemo(() => {
    const e = new DemoEngine();
    e.seedHistory();
    return e;
  }, []);
  useSyncExternalStore(engine.subscribe, engine.getVersion);
  useEffect(() => {
    // the demo clock: one real second is one second of block time; the vendor's server heartbeats while it is online
    const id = setInterval(() => engine.tick(1), 1000);
    return () => clearInterval(id);
  }, [engine]);
  return engine;
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
  const e = useEngine();
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
    (a && b && !RM ? pageTurn(a, b, cur > prev ? 1 : -1) : Promise.resolve()).then(() => {
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
      <FeeKeyPage e={e} />
    ) : route === 'live' ? (
      <Suspense fallback={<p className="boot">Opening the live register…</p>}>
        <LivePage />
      </Suspense>
    ) : null;

  return (
    <div id="app">
      <InkDefs />
      <div id="live" className="vh" aria-live="polite" ref={live} />
      <div hidden={!!page}>
        {BEATS.map(({ C, world }, i) => (
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
          <p className="rail-label" aria-hidden="true">
            {LABELS[cur]}
          </p>
          <ol>
            {LABELS.map((l, i) => (
              <li key={i}>
                <button type="button" aria-label={`Step ${i + 1}: ${l}`} aria-current={i === cur ? 'step' : 'false'} onClick={() => go(i)}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ol>
          <div className="foot">
            <span>Simulator: real circuits, no wallet</span>
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
