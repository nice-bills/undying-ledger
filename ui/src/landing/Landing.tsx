// SPDX-License-Identifier: Apache-2.0
// The front door (#/): what this is, why it matters, proof it ran on Preprod, and one way in.
// Loads no circuits, so it paints fast on a cheap phone; the demo (#/demo) loads them on demand.
// Every animation is a real action: the meeting's coins go into the box, the lid and the three
// padlocks shut, the seal lands and the receipt prints with the fee the group key really paid.
import { useEffect, useRef } from 'react';
import { PREPROD_RUN, txLink } from '../demo/preprod';
import './landing.css';

const REPO = 'https://github.com/nice-bills/undying-ledger';
const VIDEO = `${REPO}/blob/main/media/launch-wide.mp4`;
const SHARES = [3, 2, 4, 1, 2]; // the meeting the demo opens on, in shares at GH¢10
const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;

type Row = { label: string; txHash: string; feeSpeck: string };
function proofRows(): Row[] {
  const v2 = PREPROD_RUN?.v2;
  if (!v2) return [];
  const pick = (label: string) => v2.rows.find((r) => r.label === label);
  const rows = [pick('recordMeeting'), pick('sunset'), pick('voteSecretary, slot 2: elected'), v2.browser?.[0]].filter(Boolean) as Row[];
  return rows.map((r) => ({ ...r, label: r.label.replace('voteSecretary, slot 2: elected', 'voteSecretary, elected') }));
}

function Padlock({ x }: { x: number }) {
  return (
    <g transform={`translate(${x},118)`}>
      <path className="lp-cb-shackle lp-shackle" d="M8 4v-14a12 12 0 0 1 24 0V4" style={{ transform: 'translateY(-9px) rotate(-14deg)' }} />
      <rect className="lp-cb-lockbody" width="40" height="46" rx="7" />
      <circle className="lp-cb-hole" cx="20" cy="20" r="5" />
      <rect className="lp-cb-hole" x="18" y="22" width="4" height="11" rx="1" />
    </g>
  );
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const rows = proofRows();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const q = <T extends Element>(s: string) => el.querySelector<T>(s);
    const live: Animation[] = [];
    let gone = false;
    const anim = (n: Element | null, k: Keyframe[], o: KeyframeAnimationOptions = {}) => {
      if (!n || gone) return Promise.resolve();
      const a = n.animate(k, { fill: 'forwards', easing: 'cubic-bezier(.2,.8,.2,1)', ...o });
      live.push(a);
      return a.finished.catch(() => undefined);
    };
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const tally = q<HTMLSpanElement>('#lp-tally');

    (async () => {
      if (RM) {
        if (tally) tally.textContent = 'GH¢120';
        q<SVGElement>('#lp-lid')?.style.setProperty('transform', 'none');
        el.querySelectorAll<SVGElement>('#lp-locks .lp-shackle').forEach((s) => s.style.setProperty('transform', 'none'));
        return;
      }
      const stage = q<HTMLDivElement>('.lp-stage');
      let total = 0;
      await wait(500);
      for (const n of SHARES) {
        if (gone || !stage) return;
        const c = document.createElement('i');
        c.className = 'lp-coin';
        stage.appendChild(c);
        const x = (Math.random() - 0.5) * 60;
        await anim(c, [{ opacity: 0, transform: `translate(${x}px,-40px) scale(.9)` }, { opacity: 1, offset: 0.2 }, { opacity: 1, transform: 'translate(0,92px) scale(1)', offset: 0.85 }, { opacity: 0, transform: 'translate(0,108px) scale(.6)' }], { duration: 560, easing: 'cubic-bezier(.5,0,.75,0)' });
        c.remove();
        total += n * 10;
        if (tally) tally.textContent = `GH¢${total}`;
        anim(tally, [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 220, fill: 'none' });
      }
      await anim(q('#lp-lid'), [{ transform: 'rotate(-14deg)' }, { transform: 'rotate(2deg)', offset: 0.8 }, { transform: 'rotate(0)' }], { duration: 420 });
      for (const s of el.querySelectorAll('#lp-locks .lp-shackle')) {
        await anim(s, [{ transform: 'translateY(-9px) rotate(-14deg)' }, { transform: 'translateY(2px) rotate(0)', offset: 0.7 }, { transform: 'translateY(0) rotate(0)' }], { duration: 200 });
        await wait(60);
      }
      await anim(q('#lp-seal'), [{ transform: 'rotate(-30deg) scale(1.6)', opacity: 0 }, { transform: 'rotate(-8deg) scale(.92)', opacity: 1, offset: 0.7 }, { transform: 'rotate(-10deg) scale(1)', opacity: 1 }], { duration: 380 });
      await anim(q('#lp-receipt'), [{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-20px)' }, { clipPath: 'inset(0 0 0 0)', transform: 'translateY(0)' }], { duration: 700, easing: 'steps(14,end)' });
    })();

    // below the hero, each row plays its own small real action as it scrolls in
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          const t = e.target as HTMLElement;
          if (RM) {
            t.style.opacity = '1';
            t.style.transform = 'none';
            return;
          }
          anim(t, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 520 });
          const later = (sel: string, k: Keyframe[], o: KeyframeAnimationOptions, ms = 450) => {
            const n = t.querySelector(sel);
            if (n) setTimeout(() => anim(n, k, o), ms);
          };
          later('.ic-shackle', [{ transform: 'none' }, { transform: 'translateY(-6px) rotate(-22deg)' }], { duration: 420 });
          later('.ic-tank', [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.94)' }], { duration: 700 });
          later('.ic-vendor', [{ transform: 'none', opacity: 1 }, { transform: 'translateY(4px) rotate(12deg)', offset: 0.3 }, { transform: 'translateY(40px) rotate(28deg)', opacity: 0 }], { duration: 760, easing: 'cubic-bezier(.5,0,.8,.5)' });
          later('.ic-votes circle:nth-child(3)', [{ fill: 'rgba(255,243,218,.2)', transform: 'scale(.6)' }, { fill: '#F4B23A', transform: 'scale(1)' }], { duration: 420 }, 650);
          later('.lp-big', [{ transform: 'translateY(30px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 600 }, 0);
        }),
      { root: el, threshold: 0.35 },
    );
    el.querySelectorAll('.lp-reveal').forEach((n) => io.observe(n));
    return () => {
      gone = true;
      io.disconnect();
      live.forEach((a) => a.cancel());
    };
  }, []);

  return (
    <div className="landing" ref={root} data-testid="landing">
      <div className="lp-wrap">
        <nav aria-label="Undying Ledger">
          <a className="lp-brand" href="#/">
            <svg viewBox="0 0 30 30" aria-hidden="true">
              <rect x="2" y="9" width="26" height="18" rx="4" fill="#F4B23A" />
              <rect x="2" y="6" width="26" height="6" rx="3" fill="#F7C05A" />
              <rect x="11" y="8" width="8" height="2" rx="1" fill="#0A4434" />
              <rect x="12" y="15" width="6" height="7" rx="1.5" fill="#0A4434" />
            </svg>
            Undying Ledger
          </a>
          <div className="lp-links">
            <a href="#/live" className="lp-hide-s">
              On Preprod
            </a>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </nav>

        <section className="lp-hero">
          <div>
            <h1>
              The group’s book <em>outlives</em> the grant.
            </h1>
            <p className="lp-sub">A savings group’s record book on Midnight. Private passbooks, no fees for members, and no vendor to switch it off.</p>
            <a className="lp-cta" href="#/demo">
              Open the demo <span className="lp-slot" aria-hidden="true" />
            </a>
            <a className="lp-second" href={VIDEO} target="_blank" rel="noreferrer">
              Watch 57 s
            </a>
          </div>
          <div className="lp-stage" role="img" aria-label="A cash box takes meeting 12’s coins, locks, and prints its receipt">
            <div className="lp-tally" aria-hidden="true">
              <span id="lp-tally">GH¢0</span>
              <small>meeting 12, counted in</small>
            </div>
            <svg className="lp-box" viewBox="0 0 330 230" aria-hidden="true">
              <rect className="lp-cb-handle" x="128" y="22" width="74" height="22" rx="8" />
              <rect className="lp-cb-body" x="22" y="70" width="286" height="140" rx="12" />
              <rect className="lp-cb-band" x="22" y="86" width="286" height="10" />
              <g id="lp-locks">
                <Padlock x={64} />
                <Padlock x={145} />
                <Padlock x={226} />
              </g>
              <g className="lp-lid" id="lp-lid" style={{ transform: 'rotate(-14deg)' }}>
                <rect className="lp-cb-lid" x="14" y="48" width="302" height="34" rx="10" />
                <rect className="lp-cb-slot" x="138" y="58" width="54" height="9" rx="4.5" />
              </g>
            </svg>
            <div className="lp-seal" id="lp-seal" aria-hidden="true">
              <span>KPALSI</span>
              <b>12</b>
              <span>sealed</span>
            </div>
            <div className="lp-receipt" id="lp-receipt">
              <div className="lp-t">RECEIPT, MEETING 12</div>
              <div className="lp-r">
                <span>Fee</span>
                <b>1 SPECK</b>
              </div>
              <div className="lp-r">
                <span>Paid by</span>
                <b>the group fee key</b>
              </div>
              <div className="lp-r">
                <span>Members paid</span>
                <b>nothing</b>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-problem lp-reveal">
          <p>
            When the grant ends, the app costs <span className="lp-n">$10</span> a month a group. Three months later, <span className="lp-n">15</span>% are still recording.
          </p>
          <div className="lp-src">hiveonline pricing; Jamii.one, Kenya, 708 groups. Sources in the README.</div>
        </section>

        <section className="lp-does" aria-label="What it does">
          <div className="lp-row lp-reveal">
            <svg className="lp-ic" viewBox="0 0 84 64" aria-hidden="true">
              <rect x="22" y="26" width="40" height="34" rx="7" fill="#F4B23A" />
              <path className="ic-shackle" d="M30 26v-8a12 12 0 0 1 24 0v8" fill="none" stroke="#F4B23A" strokeWidth="7" strokeLinecap="round" style={{ transformBox: 'fill-box', transformOrigin: '0% 100%' }} />
              <circle cx="42" cy="40" r="4" fill="#0E5A43" />
            </svg>
            <div>
              <h3>Her passbook opens on her phone only.</h3>
              <p>Amounts never go on chain. Her husband’s phone sees a sealed line.</p>
            </div>
          </div>
          <div className="lp-row lp-reveal">
            <svg className="lp-ic" viewBox="0 0 84 64" aria-hidden="true">
              <rect x="8" y="24" width="68" height="16" rx="8" fill="rgba(255,243,218,.16)" />
              <rect className="ic-tank" x="8" y="24" width="68" height="16" rx="8" fill="#F4B23A" style={{ transformBox: 'fill-box', transformOrigin: '0 50%' }} />
            </svg>
            <div>
              <h3>The group pays the fee. Members hold nothing.</h3>
              <p>One shared fee key, endowed once by the NGO. 1 SPECK a call on Preprod.</p>
            </div>
          </div>
          <div className="lp-row lp-reveal">
            <svg className="lp-ic" viewBox="0 0 84 64" aria-hidden="true">
              <g className="ic-vendor" style={{ transformBox: 'fill-box', transformOrigin: '50% 0' }}>
                <path d="M32 22v-6a10 10 0 0 1 20 0v6" fill="none" stroke="#B8391F" strokeWidth="6" />
                <rect x="28" y="22" width="28" height="26" rx="5" fill="#B8391F" />
                <text x="42" y="41" textAnchor="middle" fontFamily="Archivo" fontWeight="900" fontSize="15" fill="#FFF3DA">
                  V
                </text>
              </g>
            </svg>
            <div>
              <h3>When the vendor goes, the book keeps going.</h3>
              <p>Anyone can call sunset after the grace period. Admin powers end for good.</p>
            </div>
          </div>
          <div className="lp-row lp-reveal">
            <svg className="lp-ic" viewBox="0 0 84 64" aria-hidden="true">
              <g className="ic-votes">
                <circle cx="22" cy="32" r="9" fill="#F4B23A" />
                <circle cx="42" cy="32" r="9" fill="#F4B23A" />
                <circle cx="62" cy="32" r="9" fill="rgba(255,243,218,.2)" style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }} />
              </g>
            </svg>
            <div>
              <h3>Lost the secretary’s phone? Members vote.</h3>
              <p>More than half of the group elects a new one, even after sunset.</p>
            </div>
          </div>
        </section>

        {rows.length > 0 && (
          <section className="lp-proof lp-reveal" id="proof" data-testid="landing-proof">
            <div>
              <div className="lp-big">0</div>
              <h2>DUST in members’ wallets. Ran on Midnight Preprod.</h2>
            </div>
            <ul className="lp-tx">
              {rows.map((r) => (
                <li key={r.txHash}>
                  <span>{r.label}</span>
                  <code>{short(r.txHash)}</code>
                  <a href={txLink(r.txHash)} target="_blank" rel="noreferrer" aria-label={`${r.label} on the explorer, fee ${r.feeSpeck} SPECK`}>
                    {r.feeSpeck} SPECK
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <footer>
        <div className="lp-wrap">
          <span>Built for the AKINDO Midnight Buildathon. Apache-2.0.</span>
          <nav aria-label="More">
            <a href="#/live">All transactions</a>
            <a href={REPO} target="_blank" rel="noreferrer">
              GitHub
            </a>
            <a href="#/terms">Terms</a>
            <a href="#/privacy">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
