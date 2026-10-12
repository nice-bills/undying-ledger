// SPDX-License-Identifier: Apache-2.0
// Beat 4: the grant ends. The vendor's server stops heartbeating, the contract's own clock runs
// down the grace period, and the screen moves toward dusk only because that time passes.
// Calling sunset early is refused by the circuit; after the grace period any member can call it,
// and the vendor's padlock comes off the box for good.
import { useEffect, useRef, useState } from 'react';
import { Phase } from '@undying-ledger/contract';
import { DEMO_GRACE_SECONDS } from '../demo/engine';
import { CashBox, Screen, Seal } from '../box/art';
import { anim, pop, RM, shake, vendorFalls, wait } from '../box/motion';
import { contractWords, type BeatProps } from './types';

const CALLER = 'Abiba (a member)';
// flat colours from day to dusk; the beat's background transitions between them (no gradients)
const SKY = ['#0E5A43', '#2E5B36', '#55562A', '#7A5220', '#8C4A1A'];

export function SunsetBeat({ e, go, announce }: BeatProps) {
  const pub = e.publicState();
  const sunset = e.phase === Phase.SUNSET;
  const ended = !e.vendorOnline;
  const opensIn = e.sunsetOpensIn;
  const [skipShow, setSkipShow] = useState<number | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [struck, setStruck] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<SVGSVGElement>(null);
  const notYet = useRef<HTMLDivElement>(null);
  const sunStamp = useRef<HTMLDivElement>(null);
  const pulse = useRef<HTMLElement>(null);
  const strike = useRef<HTMLElement>(null);
  const line3 = useRef<HTMLLIElement>(null);

  const secs = skipShow ?? opensIn;
  const sinceBeat = Math.max(0, e.elapsed - pub.lastHeartbeat);

  // each real heartbeat from the vendor's server makes the light blink once
  useEffect(() => {
    if (!ended && !sunset) anim(pulse.current, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(2.2)', opacity: 0 }], { duration: 700, fill: 'none' });
  }, [pub.lastHeartbeat, ended, sunset]);

  const p = sunset ? 1 : ended ? 0.2 + 0.75 * (1 - Math.min(1, secs / DEMO_GRACE_SECONDS)) : 0;
  useEffect(() => {
    const beat = root.current?.closest<HTMLElement>('.beat');
    if (beat) beat.style.backgroundColor = SKY[Math.min(SKY.length - 1, Math.round(p * (SKY.length - 1)))];
  }, [p]);

  const endGrant = () => {
    e.grantEnds();
    announce(`Grant ended. The vendor stopped checking in. Sunset opens after ${e.sunsetOpensIn} seconds.`);
  };

  const skip = () => {
    const a = e.sunsetOpensIn;
    if (a <= 0) return;
    const t0 = performance.now();
    const f = (t: number) => {
      const q = Math.min(1, (t - t0) / (RM ? 1 : 900));
      setSkipShow(Math.max(0, Math.ceil(a * (1 - q * q))));
      if (q < 1) requestAnimationFrame(f);
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
      await shake(box.current?.querySelector('.cb-vendor') ?? null, 5);
      await pop(notYet.current, 6);
      setErr(`Refused by the book: “${contractWords(r.error ?? '')}”. The vendor still has ${e.sunsetOpensIn} s to check in.`);
      setBusy(false);
      announce('Sunset refused. The grace period is not over.');
      return;
    }
    setErr('');
    if (notYet.current?.dataset.down) anim(notYet.current, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
    await vendorFalls(box.current);
    setStruck(true);
    await anim(strike.current, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 380, easing: 'cubic-bezier(.45,.05,.3,1)' });
    await anim(line3.current, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320 });
    await wait(80);
    await pop(sunStamp.current, -9);
    setBusy(false);
    announce('Sunset called. The vendor key is erased. Nobody can switch the book off.');
  };

  const erased = /^0+$/.test(pub.maintainerKey);
  const showStruck = struck || sunset;
  return (
    <div ref={root} style={{ display: 'contents' }}>
      <Screen who={<><b>Abiba</b>’s phone, any member</>} where={sunset ? 'Sunset done' : ended ? 'Vendor silent' : 'Vendor checking in'}>
        <h2 className="h1" tabIndex={-1}>
          The grant ends
        </h2>
        <div className="hero-row">
          <div className="hero num" data-testid="countdown" style={{ fontSize: sunset ? 'var(--hero-l)' : 'var(--hero-xl)' }}>
            {sunset ? (
              <span>{erased ? 'Erased' : 'Set'}</span>
            ) : (
              <>
                <span className="secs">{ended ? secs : DEMO_GRACE_SECONDS}</span>
                <small className="unit">s</small>
              </>
            )}
          </div>
        </div>
        <p className="hero-sub">{sunset ? 'Vendor key. Nobody can switch this book off.' : ended ? 'until any member may call sunset' : 'of vendor silence before sunset opens'}</p>
        <div className="burn" aria-hidden="true">
          <i style={{ transform: `scaleX(${sunset ? 0 : ended ? (secs / DEMO_GRACE_SECONDS).toFixed(3) : 1})` }} />
        </div>
        <div className="boxstage">
          <CashBox ref={box} vendor={sunset ? 'gone' : 'on'} title={sunset ? 'The cash box with only the members’ three padlocks' : 'The cash box with the vendor’s red padlock on the hasp'} label={sunset ? 'ONLY MEMBERS’ LOCKS NOW' : 'V = VENDOR’S ADMIN LOCK'} />
          <Seal ref={notYet} top="REFUSED" mid="Not yet" tone="red" style={{ left: '30%', top: '26%', visibility: 'hidden' }} testId="notyet" />
          <Seal ref={sunStamp} top="VENDOR KEY ERASED" mid="Sunset" sub={`meeting ${pub.meetings}`} tone="cream" style={{ right: 4, top: -10, visibility: sunset ? 'visible' : 'hidden' }} testId="sunset-stamp" />
        </div>
        <section className="sheet" aria-label="Endorsements">
          <p className="hb" data-testid="heartbeat">
            {ended || sunset ? (
              <>
                <i className="off" />
                No check-in since the grant ended
              </>
            ) : (
              <>
                <i>
                  <em ref={pulse} />
                </i>
                Vendor checked in {sinceBeat} s ago
              </>
            )}
          </p>
          <ol className="end">
            <li>
              <em>i</em>
              <span>Opened with support from the NGO grant.</span>
            </li>
            <li className={showStruck ? 'gone' : ''}>
              <em>ii</em>
              <span className="strk">
                Vendor key may administer this book while it keeps checking in.
                <i ref={strike} style={{ transform: showStruck ? undefined : 'scaleX(0)' }} />
              </span>
            </li>
            <li ref={line3} hidden={!showStruck}>
              <em>iii</em>
              <span>
                Sunset called by a member, <b>Abiba</b>. Vendor key erased. Nobody can switch this book off.
              </span>
            </li>
          </ol>
          <p className="err" role="status" data-testid="err-sunset">
            {err}
          </p>
          <div className="cta">
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
            {sunset && !busy && (
              <button className="btn" type="button" onClick={() => go(4)}>
                Hold meeting {pub.meetings + 1}
              </button>
            )}
          </div>
        </section>
      </Screen>
    </div>
  );
}
