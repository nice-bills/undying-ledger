// SPDX-License-Identifier: Apache-2.0
// Beat 3: the shared household phone. It reads only the public ledger: member keys, a meeting
// count and one sealed commitment per slot. "Try to open" runs the real stamp check with a
// guessed group secret and the exact passbook figures; the commitment does not match, so the
// padlocks rattle and stay shut.
import { useEffect, useRef, useState } from 'react';
import { CashBox, Screen, Seal } from '../box/art';
import { anim, pop, shake, wait } from '../box/motion';
import type { BeatProps } from './types';

const group4 = (hex: string) => `${hex.slice(0, 4)} ${hex.slice(4, 8)} ${hex.slice(8, 12)}`;

export function HusbandBeat({ e, active, go, announce }: BeatProps) {
  const pub = e.publicState();
  const [err, setErr] = useState('');
  const inked = useRef(false);
  const box = useRef<SVGSVGElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const stamp = useRef<HTMLDivElement>(null);
  const SLOT = 0;

  useEffect(() => {
    if (!active || inked.current) return;
    inked.current = true;
    const bars = [...(list.current?.querySelectorAll('.bar') ?? [])];
    bars.forEach((b, i) => anim(b, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 320, delay: 120 + i * 45, easing: 'cubic-bezier(.3,.7,.3,1)' }));
  }, [active]);

  const tryOpen = async () => {
    const opened = e.outsiderTriesToOpen(SLOT); // real check against the on-chain commitment
    if (opened) {
      setErr('The commitment opened. This should never happen; please report it.');
      return;
    }
    // every padlock rattles: he holds none of the keys, and the slot needs the group secret
    const locks = [0, 1, 2].map((i) => box.current?.querySelector(`.lock-${i}`) ?? null);
    await Promise.all(locks.map((l, i) => wait(i * 60).then(() => shake(l, 4))));
    await shake(list.current?.querySelector('li') ?? null, 6);
    if (!stamp.current?.dataset.down) await pop(stamp.current, -7);
    setErr('Opening a slot needs the group secret. Guessing the exact amount does not match the seal either.');
    announce('Cannot open. The slot needs the group secret.');
  };

  return (
    <Screen who={<b>Shared household phone</b>} where="Public record">
      <h2 className="h1" tabIndex={-1}>
        What he can see
      </h2>
      <p className="hero-sub">Her book stays locked on this phone.</p>
      <div className="boxstage">
        <CashBox ref={box} title="The cash box, all three padlocks shut" label="NO KEY ON THIS PHONE" />
        <Seal ref={stamp} top="REFUSED" mid="Cannot open" tone="red" style={{ left: '22%', top: '30%', visibility: 'hidden' }} testId="cannot" />
      </div>
      <div className="pub">
        <div>
          <span className="label">Members</span>
          <b className="num" data-testid="pub-members">
            {pub.memberCount} keys
          </b>
          <span className="note">no names</span>
        </div>
        <div>
          <span className="label">Meetings recorded</span>
          <b className="num" data-testid="pub-meetings">
            {pub.meetings}
          </b>
          <span className="note">all sealed</span>
        </div>
        <div>
          <span className="label">SMS</span>
          <b>none</b>
          <span className="note">sent, ever</span>
        </div>
      </div>
      <section className="sheet dark" aria-label="The public register">
        <ol className="register" ref={list} data-testid="register">
          {pub.slots.slice(0, 5).map((s, i) => (
            <li key={s.slot} aria-label={`Slot ${s.slot}, version ${s.version}: sealed, no name, no amount`}>
              <span className="slot num">{s.slot}</span>
              <span className="sealed">
                <span className="bar" style={{ width: `${46 + ((i * 23) % 30)}%` }} />
                <span className="hash">{group4(s.commitment)}</span>
              </span>
              <span className="bar sm" style={{ width: 28 + ((i * 11) % 18) }} />
            </li>
          ))}
        </ol>
        <p className="err" role="status" data-testid="err-open">
          {err}
        </p>
        <div className="cta">
          <button className="btn ghost" type="button" onClick={tryOpen}>
            Try to open slot {SLOT}
          </button>
          <button className="btn" type="button" onClick={() => go(3)}>
            The grant ends
          </button>
        </div>
      </section>
    </Screen>
  );
}
