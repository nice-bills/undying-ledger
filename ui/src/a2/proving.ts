// SPDX-License-Identifier: Apache-2.0
// The proving state. In this simulator the real Compact circuit runs in the browser (fast) and
// no zero-knowledge proof is made, so the skeleton stays up for a short minimum time and the
// copy says exactly that. Real proof times appear here once they are measured on Preprod.
import { FAST, RM } from './motion';

export type ProvingOpts<T> = {
  /** Minimum time the skeleton is shown, in ms (shortened with ?fast for recordings). */
  minMs: number;
  steps: string[];
  onStep: (label: string) => void;
  timer?: HTMLElement | null;
  /** The real work: a circuit run against the engine. Runs after the skeleton has painted. */
  work: () => T;
};

export async function proving<T>({ minMs, steps, onStep, timer, work }: ProvingOpts<T>): Promise<{ result: T; circuitMs: number }> {
  const total = RM ? Math.min(minMs, 300) : FAST ? Math.min(minMs, 1300) : minMs;
  const t0 = performance.now();
  let k = -1;
  const paint = () => {
    const el = performance.now() - t0;
    const p = Math.min(1, el / total);
    const i = Math.min(steps.length - 1, Math.floor(p * steps.length));
    if (i !== k) {
      k = i;
      onStep(steps[i]);
    }
    if (timer) timer.textContent = `${(el / 1000).toFixed(1)} s`;
  };
  paint();
  await new Promise((r) => setTimeout(r, 60)); // let the skeleton paint before the synchronous circuit run
  const c0 = performance.now();
  const result = work();
  const circuitMs = performance.now() - c0;
  await new Promise<void>((res) => {
    const iv = setInterval(() => {
      paint();
      if (performance.now() - t0 >= total) {
        clearInterval(iv);
        res();
      }
    }, 100);
  });
  return { result, circuitMs };
}
