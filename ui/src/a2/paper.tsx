// SPDX-License-Identifier: Apache-2.0
// The physical objects of the A2 Passbook: an open leaf on a cloth cover, loose papers,
// rubber stamps with uneven ink, and the cedi sign stand-in.
import { forwardRef, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { edgePoly, rng, type EdgeSpec } from './motion';

// ------------------------------------------------------------------ cedi

/** GH¢ is how prices are written in Ghanaian markets and shops, and every face here has ¢
 *  (a drawn stroke on a C read as a text cursor). Screen readers hear ₵. */
export function Ced() {
  return (
    <span className="ced">
      <span aria-hidden="true">¢</span>
      <span className="vh">₵</span>
    </span>
  );
}
export function Ghs({ n }: { n: number }) {
  return (
    <>
      GH<Ced />
      {n.toLocaleString('en-GH')}
    </>
  );
}

// ------------------------------------------------------------------ leaf

let leafSeed = 40;

type LeafProps = {
  band: [ReactNode, ReactNode];
  dog?: boolean;
  children: ReactNode;
  sheetId?: string;
  sheetRef?: React.Ref<HTMLDivElement>;
};

/** An open page on its cloth cover: under-pages at the fore-edge, top edge dipping into the spine, deckled edges. */
export function Leaf({ band, dog, children, sheetId, sheetRef }: LeafProps) {
  const face = useRef<HTMLDivElement>(null);
  const u1 = useRef<HTMLDivElement>(null);
  const u2 = useRef<HTMLDivElement>(null);
  const seed = useRef(0);
  if (!seed.current) seed.current = (leafSeed += 3);
  useLayoutEffect(() => {
    const s = seed.current;
    if (face.current)
      face.current.style.clipPath = edgePoly({
        seed: s,
        top: { amp: 1.2, n: 40, spine: 7 },
        right: { kind: 'deckle', amp: 2.2, n: 120 },
        bottom: { kind: 'deckle', amp: 2, n: 50 },
        fold: dog ? 26 : 0,
      });
    [u1.current, u2.current].forEach((u, i) => {
      if (u) u.style.clipPath = edgePoly({ seed: s + 1 + i, top: { amp: 1, n: 30, spine: 9 }, right: { kind: 'deckle', amp: 2.6, n: 110 }, bottom: { kind: 'deckle', amp: 2.4, n: 40 } });
    });
  }, [dog]);
  return (
    <>
      <div className="band">
        <span>{band[0]}</span>
        <span>{band[1]}</span>
      </div>
      <div className="leaf">
        <div className="under u2" ref={u2} />
        <div className="under u1" ref={u1} />
        <div className="sheet" id={sheetId} ref={sheetRef}>
          <div className="face" ref={face} />
          <div className="spine">
            <i />
            <i />
            <i />
          </div>
          {dog && <div className="dog" />}
          {children}
          <svg className="penlayer" aria-hidden="true" />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ loose paper

type LooseProps = {
  className: string;
  edge: EdgeSpec;
  tilt: number;
  style?: CSSProperties;
  children: ReactNode;
  shown?: boolean;
  role?: string;
  ariaLive?: 'polite';
};

export const Loose = forwardRef<HTMLDivElement, LooseProps>(function Loose({ className, edge, tilt, style, children, shown, role, ariaLive }, ref) {
  const inner = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    el.style.clipPath = edgePoly(edge);
    el.style.setProperty('--inner', edgePoly({ ...edge, inset: 1.3 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={(n) => {
        inner.current = n;
        if (typeof ref === 'function') ref(n);
        else if (ref) ref.current = n;
      }}
      className={`loose ${className}`}
      data-tilt={tilt}
      hidden={!shown}
      style={{ ...style, transform: shown ? `rotate(${tilt}deg)` : undefined }}
      role={role}
      aria-live={ariaLive}
    >
      {children}
    </div>
  );
});

// ------------------------------------------------------------------ stamps

/** Six uneven inks: fine speckle times a low-frequency pressure mask, so one side prints heavier. */
export function InkDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <filter key={k} id={`ink${k}`} x="-6%" y="-6%" width="112%" height="112%">
            <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves={2} seed={k * 7 + 3} result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.48" result="speck" />
            <feTurbulence type="fractalNoise" baseFrequency=".022" numOctaves={1} seed={k * 13 + 5} result="p" />
            <feColorMatrix in="p" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -.36" result="press" />
            <feComposite in="speck" in2="press" operator="arithmetic" k1={1} result="mask" />
            <feComposite in="SourceGraphic" in2="mask" operator="in" result="t" />
            <feDisplacementMap in="t" in2="n" scale={1.6} />
          </filter>
        ))}
      </defs>
    </svg>
  );
}

function Ring({ id, size, outer, inner, arc, mid, sub, midSize = 34 }: { id: string; size: number; outer: number; inner: number; arc: string; mid: string; sub?: string; midSize?: number }) {
  const c = size / 2;
  const ra = (outer + inner) / 2 + 1;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g fill="none" stroke="currentColor">
        <circle cx={c} cy={c} r={outer} strokeWidth={3.4} />
        <circle cx={c} cy={c} r={inner} strokeWidth={1.5} />
      </g>
      <defs>
        <path id={id} d={`M${c} ${c} m-${ra} 0 a${ra} ${ra} 0 1 1 ${ra * 2} 0 a${ra} ${ra} 0 1 1 -${ra * 2} 0`} />
      </defs>
      <text fill="currentColor" fontFamily="Schibsted Grotesk" fontWeight={700} fontSize={size > 120 ? 10.5 : 9} letterSpacing={2}>
        <textPath href={`#${id}`}>{arc}</textPath>
      </text>
      <text x={c} y={c + (sub ? -2 : 7)} textAnchor="middle" fill="currentColor" fontFamily="Libre Caslon Display" fontSize={midSize}>
        {mid}
      </text>
      {sub && (
        <text x={c} y={c + 19} textAnchor="middle" fill="currentColor" fontFamily="Schibsted Grotesk" fontWeight={600} fontSize={10.5}>
          {sub}
        </text>
      )}
    </svg>
  );
}

function Box({ w, h, dbl = true, children }: { w: number; h: number; dbl?: boolean; children: ReactNode }) {
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect x={2} y={2} width={w - 4} height={h - 4} fill="none" stroke="currentColor" strokeWidth={2.8} />
      {dbl && <rect x={6.5} y={6.5} width={w - 13} height={h - 13} fill="none" stroke="currentColor" strokeWidth={1.1} />}
      {children}
    </svg>
  );
}

export type StampKind = 'seal' | 'paid' | 'match' | 'cannot' | 'notyet' | 'sunset' | 'verified';

function stampArt(kind: StampKind, id: string, text: string) {
  switch (kind) {
    case 'seal':
      return <Ring id={id} size={128} outer={60} inner={44} arc="KPALSI WOMEN’S GROUP  TAMALE  RECORDED  " mid={text} sub="sealed" />;
    case 'paid':
      return (
        <Box w={78} h={34} dbl={false}>
          <text x={39} y={24} textAnchor="middle" fill="currentColor" fontFamily="Schibsted Grotesk" fontWeight={800} fontSize={17} letterSpacing={3}>
            PAID
          </text>
        </Box>
      );
    case 'match':
      return (
        <Box w={118} h={46}>
          <text x={59} y={21} textAnchor="middle" fill="currentColor" fontFamily="Schibsted Grotesk" fontWeight={700} fontSize={11.5}>
            Matches
          </text>
          <text x={59} y={35} textAnchor="middle" fill="currentColor" fontFamily="Schibsted Grotesk" fontWeight={600} fontSize={10.5}>
            {text}
          </text>
        </Box>
      );
    case 'cannot':
      return (
        <Box w={186} h={54}>
          <text x={93} y={35} textAnchor="middle" fill="currentColor" fontFamily="Libre Caslon Display" fontSize={23}>
            Cannot open
          </text>
        </Box>
      );
    case 'notyet':
      return (
        <Box w={118} h={48} dbl={false}>
          <text x={59} y={32} textAnchor="middle" fill="currentColor" fontFamily="Libre Caslon Display" fontSize={23}>
            Not yet
          </text>
        </Box>
      );
    case 'sunset':
      return <Ring id={id} size={118} outer={55} inner={41} arc={`VENDOR KEY ERASED  ${text}  `} mid="Sunset" midSize={21} />;
    case 'verified':
      return <Ring id={id} size={104} outer={49} inner={37} arc="CHECKED  PROOF ONLY  CHECKED  " mid="Verified" midSize={18} />;
  }
}

let stampCount = 0;
const STAMP_R = rng(1209);

type StampProps = {
  kind: StampKind;
  ink: 'carmine' | 'violet' | 'cobalt' | 'paid';
  text?: string;
  style?: CSSProperties;
  id?: string;
  testId?: string;
  /** Lay the stamp on a patch of the page's own paper, so ink under it (redaction bars) cannot show through. */
  backed?: boolean;
};

/** A rubber stamp, invisible until stampDown() lands it. Each has its own ink filter and a small seeded tilt. */
export const Stamp = forwardRef<HTMLDivElement, StampProps>(function Stamp({ kind, ink, text = '', style, id, testId, backed }, ref) {
  const meta = useRef<{ n: number; r: string } | null>(null);
  if (!meta.current) {
    const n = stampCount++;
    const sgn = STAMP_R() < 0.5 ? -1 : 1;
    meta.current = { n, r: `${(sgn * (2 + 4 * STAMP_R())).toFixed(1)}deg` };
  }
  const { n, r } = meta.current;
  return (
    <div ref={ref} id={id} data-testid={testId} className={`stamp ink-${ink}${backed ? ' backed' : ''}`} style={{ ...style, ['--r' as string]: r, ['--ink' as string]: `url(#ink${n % 6})` }}>
      {stampArt(kind, `arc-${kind}-${n}`, text)}
    </div>
  );
});
