// SPDX-License-Identifier: Apache-2.0
// The group fee key page: the DUST "commons" that pays every fee so members hold nothing.
// Same engine: a relative can point their DUST here, a copied key can burn fees but not write
// the book, time refills it, and the group can rotate to a fresh key.
import { useEffect, useRef } from 'react';
import type { DemoEngine } from '../demo/engine';
import { FEE_IS_MEASURED, FEE_TEXT, SECONDS_TO_CAP } from '../demo/fees';
import { MEASURED } from '../demo/measured';
import { Leaf } from '../a2/paper';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function FeeKeyPage({ e }: { e: DemoEngine }) {
  const f = e.fees;
  const pct = f.cap ? f.balance / f.cap : 0;
  const hasRelative = f.supporters.some((s) => s.name.startsWith('Brother'));
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => h.current?.focus({ preventScroll: true }), []);
  return (
    <section className="beat w-green" aria-label="Group fee key" style={{ bottom: 0 }} data-testid="fee-key">
      <Leaf band={[<><b>Group fee key</b> {f.epoch}</>, <a href="#/demo" key="b">Back to the book</a>]}>
        <h2 className="disp" tabIndex={-1} ref={h}>
          Fee key {f.epoch}
        </h2>
        <p className="lede">One DUST key per group, kept inside the members’ app.</p>
        <div className="gauge" style={{ width: '80%' }}>
          <div className="head">
            <span className="label">Balance</span>
            <b className="num" data-testid="fk-balance">
              {f.balance.toFixed(1)} of {f.cap} DUST
            </b>
          </div>
          <div className="scale">
            <span className="fill" style={{ transform: `scaleX(${pct.toFixed(4)})` }} />
            <span className="ticks" />
          </div>
          <div className="tl">
            <span>0</span>
            <span>{f.cap / 2}</span>
            <span>{f.cap}</span>
          </div>
        </div>
        <div className="prose">
          <p>
            Refills about {((f.cap / SECONDS_TO_CAP) * 86400).toFixed(0)} DUST a day, full in about a week. {f.txCount} fees paid so far
            {e.pendingRotationNote ? '; the new key is filling and its tag is not on the ledger yet' : ''}.
          </p>
          <p>
            DUST only pays fees. It cannot be sent to anyone, and the NIGHT that makes it stays with its owner. Each call costs{' '}
            {FEE_IS_MEASURED ? `${FEE_TEXT}, measured on Preprod${MEASURED.measuredOn ? ` (${MEASURED.measuredOn})` : ''}` : `${FEE_TEXT} here, a placeholder until the fee is measured on Preprod`}.
          </p>
        </div>
        <h3 className="label" style={{ marginTop: 18 }}>
          Who powers this key
        </h3>
        <ul className="supporters">
          {f.supporters.map((s, i) => (
            <li key={i}>
              <span>
                <b>{s.name}</b>, {s.note}
              </span>
              <span className="num">{s.night} NIGHT</span>
            </li>
          ))}
        </ul>
        <div className="btnrow">
          <button className="btn" type="button" disabled={hasRelative} onClick={() => e.addSupporter('Brother in London', 20, 'points his NIGHT’s DUST here and sends no money')}>
            A relative points DUST here
          </button>
          <button className="btn ghost" type="button" onClick={() => e.leakAndBurn(400)}>
            Key copied: burn fees
          </button>
          <button className="btn ghost" type="button" onClick={() => e.skip(24 * 3600)}>
            Wait a day
          </button>
          <button className="btn ghost" type="button" onClick={() => e.rotateFeeKey()}>
            Rotate to a fresh key
          </button>
        </div>
        <h3 className="label" style={{ marginTop: 22 }}>
          Day book
        </h3>
        <ul className="daybook" data-testid="daybook">
          {e.log.slice(0, 14).map((l) => (
            <li key={l.id} className={l.kind}>
              <span className="t num">{clock(l.at)}</span>
              <span>
                <b>{l.who}:</b> {l.what}
                {l.fee ? ` Fee: ${l.fee}.` : ''}
              </span>
            </li>
          ))}
        </ul>
        <div style={{ height: 18 }} />
        <a className="btn" href="#/demo" style={{ textDecoration: 'none' }}>
          Back to the book
        </a>
      </Leaf>
    </section>
  );
}
