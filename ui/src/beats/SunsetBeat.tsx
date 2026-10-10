// SPDX-License-Identifier: Apache-2.0
// Beat 4: the grant ends. The vendor's server stops heartbeating, the contract's own clock runs
// down the grace period, and the amber light leans in only because that time passes. Calling
// sunset early is refused by the circuit; after the grace period any member can call it.
import { useLayoutEffect, useRef, useState } from 'react';
import { Phase } from '@undying-ledger/contract';
import { DEMO_GRACE_SECONDS } from '../demo/engine';
import { Leaf, Stamp } from '../a2/paper';
import { anim, draw, linePath, printLine, RM, reveal, stampDown, wait } from '../a2/motion';
import { contractWords, type BeatProps } from './types';

const CALLER = 'Abiba (a member)';

export function SunsetBeat({ e, go, announce }: BeatProps) {
  const pub = e.publicState();
  const sunset = e.phase === Phase.SUNSET;
  const ended = !e.vendorOnline;
  const opensIn = e.sunsetOpensIn;
  const [skipShow, setSkipShow] = useState<number | null>(null); // seconds shown while the skip animates
  const [err, setErr] = useState('');
  const [struck, setStruck] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheet = useRef<HTMLDivElement>(null);
  const section = useRef<HTMLDivElement>(null);
  const l1 = useRef<HTMLDivElement>(null);
  const l2 = useRef<HTMLDivElement>(null);
  const clock = useRef<HTMLDivElement>(null);
  const notYet = useRef<HTMLDivElement>(null);
  const sunStamp = useRef<HTMLDivElement>(null);
  const vtext = useRef<HTMLSpanElement>(null);
  const line3 = useRef<HTMLSpanElement>(null);
  const initials = useRef<HTMLSpanElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const lightP = useRef(0);

  const secs = skipShow ?? opensIn;
  const sinceBeat = Math.max(0, e.elapsed - pub.lastHeartbeat);

  // 0 = midday, 1 = sunset. Two hard-edged washes of amber slide across; no gradients.
  const target = sunset ? 1 : ended ? 0.2 + 0.65 * (1 - Math.min(1, secs / DEMO_GRACE_SECONDS)) : 0;
  useLayoutEffect(() => {
    const paint = (p: number) => {
      lightP.current = p;
      const x1 = 100 - p * 150, x2 = 120 - p * 140;
      if (l1.current) {
        l1.current.style.clipPath = `polygon(${x1 + 30}% 0,100% 0,100% 100%,${x1}% 100%)`;
        l1.current.style.opacity = (0.1 + p * 0.26).toFixed(3);
        if (p === 0) l1.current.style.opacity = '0';
      }
      if (l2.current) {
        l2.current.style.clipPath = `polygon(${x2 + 34}% 0,100% 0,100% 100%,${x2}% 100%)`;
        l2.current.style.opacity = (p * 0.16).toFixed(3);
      }
      const beat = section.current?.closest<HTMLElement>('.beat');
      if (beat) {
        beat.style.backgroundColor = p > 0.5 ? '#353A20' : p > 0.05 ? '#2A3C2C' : '';
        beat.classList.toggle('lit', p > 0.3); // keeps secondary text above 4.5:1 on the lit paper
      }
    };
    const from = lightP.current;
    if (Math.abs(target - from) < 0.002) return paint(target);
    if (RM) return paint(target);
    let raf = 0;
    const t0 = performance.now();
    const f = (t: number) => {
      const q = Math.min(1, (t - t0) / 700);
      paint(from + (target - from) * (1 - Math.pow(1 - q, 3)));
      if (q < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const endGrant = () => {
    e.grantEnds();
    announce(`Grant ended. The vendor stopped checking in. Sunset opens after ${e.sunsetOpensIn} seconds.`);
  };

  const skip = () => {
    const a = e.sunsetOpensIn;
    if (a <= 0) return;
    const t0 = performance.now();
    const f = (t: number) => {
      const p = Math.min(1, (t - t0) / (RM ? 1 : 700));
      setSkipShow(Math.max(0, Math.ceil(a * (1 - p * p))));
      if (p < 1) requestAnimationFrame(f);
      else {
        e.skip(e.sunsetOpensIn); // advance the contract's clock past the grace period
        setSkipShow(null);
        setErr('');
      }
    };
    requestAnimationFrame(f);
  };

  const callSunset = async () => {
    if (sunset || busy) return;
    setBusy(true);
    const r = e.trySunset(CALLER); // the real sunset circuit decides
    if (!r.ok) {
      await stampDown(notYet.current, clock.current);
      setErr(`Refused by the book: “${contractWords(r.error ?? '')}”. The vendor still has ${e.sunsetOpensIn} s to check in.`);
      setBusy(false);
      announce('Sunset refused. The grace period is not over.');
      return;
    }
    setErr('');
    if (notYet.current?.dataset.down) anim(notYet.current, [{ opacity: 0.9 }, { opacity: 0 }], { duration: 240, fill: 'forwards' });
    await wait(300);
    const s = sheet.current!;
    const rects = vtext.current ? [...vtext.current.getClientRects()] : [];
    const sb = s.getBoundingClientRect();
    for (const r of rects) await draw(s, linePath(r.left - sb.left - 3, r.top - sb.top + r.height * 0.56, r.right - sb.left + 4, 1.4), { ms: 240, w: 1.9 });
    setStruck(true);
    await wait(30);
    if (line3.current) await printLine([line3.current], 700);
    if (initials.current) {
      initials.current.style.visibility = 'visible';
      anim(initials.current, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 380, easing: 'cubic-bezier(.45,.05,.3,1)' });
    }
    await stampDown(sunStamp.current, clock.current);
    reveal(next.current);
    setBusy(false);
    announce('Sunset called. The vendor key is erased. Nobody can switch the book off.');
  };

  const erased = /^0+$/.test(pub.maintainerKey);
  return (
    <div ref={section} style={{ display: 'contents' }}>
      <Leaf
        band={[<><b>Abiba</b>’s phone, any member</>, sunset ? 'Sunset done' : ended ? 'Vendor silent' : 'Vendor checking in']}
        dog
        sheetRef={sheet}
      >
        <h2 className="disp" tabIndex={-1}>
          The grant ends
        </h2>
        <p className="lede">Endorsements, inside front cover</p>
        <ol className="end">
          <li>
            <em>i</em>Opened with support from the NGO grant.
          </li>
          <li style={struck || sunset ? { color: 'var(--ink-2)' } : undefined}>
            <em>ii</em>
            <span ref={vtext}>Vendor key may administer this book while it keeps checking in.</span>
            <br />
            <span className="hb" data-testid="heartbeat">
              {ended || sunset ? (
                <>
                  <i className="off" />
                  No check-in since the grant ended
                </>
              ) : (
                <>
                  <i />
                  Last check-in {sinceBeat} s ago
                </>
              )}
            </span>
          </li>
          <li hidden={!(struck || sunset)}>
            <em>iii</em>
            <span className="prt" ref={line3} style={struck ? undefined : { visibility: 'hidden' }}>
              Sunset called by a member. Vendor key erased. Nobody can switch this book off.
            </span>{' '}
            <span className="hand tilt" ref={initials} style={{ ['--t' as string]: '-6deg', fontSize: 24, visibility: struck ? undefined : 'hidden' }}>
              Abiba
            </span>
          </li>
        </ol>
        <div style={{ position: 'relative' }} ref={clock}>
          <div className="clock">
            <div>
              <span className="label">{sunset ? 'Vendor key' : 'Sunset opens after'}</span>
              <div className="fig num" data-testid="countdown">
                {sunset ? (
                  <span style={{ fontSize: 56 }}>{erased ? 'Erased' : 'Set'}</span>
                ) : (
                  <>
                    <span className="secs">{ended ? secs : DEMO_GRACE_SECONDS}</span>
                    <small>s</small>
                  </>
                )}
              </div>
            </div>
            <p className="note" style={{ maxWidth: 120, marginBottom: 4 }}>
              {sunset ? '' : 'of silence from the vendor'}
            </p>
          </div>
          <div className="burn">
            <i style={{ transform: `scaleX(${sunset ? 0 : ended ? (secs / DEMO_GRACE_SECONDS).toFixed(3) : 1})` }} />
          </div>
          <Stamp ref={notYet} kind="notyet" ink="carmine" style={{ left: 150, top: -30 }} testId="notyet" />
          <Stamp ref={sunStamp} kind="sunset" ink="cobalt" text={`MEETING ${pub.meetings}`} style={{ right: 0, top: -34 }} testId="sunset-stamp" />
        </div>
        <p className="err" role="status" data-testid="err-sunset">
          {err}
        </p>
        <div style={{ height: 16 }} />
        {!ended && !sunset && (
          <button className="btn" type="button" onClick={endGrant}>
            End the grant
          </button>
        )}
        {ended && !sunset && (
          <div className="pair">
            <button className="btn ghost" type="button" onClick={skip} disabled={secs <= 0 || skipShow !== null}>
              Skip the wait
            </button>
            <button className="btn" type="button" onClick={callSunset} disabled={busy || skipShow !== null}>
              Call sunset
            </button>
          </div>
        )}
        <button className="btn" type="button" ref={next} hidden={!sunset || busy} onClick={() => go(4)}>
          Hold meeting {pub.meetings + 1}
        </button>
      </Leaf>
      <div className="light l1" ref={l1} />
      <div className="light l2" ref={l2} />
    </div>
  );
}
