// SPDX-License-Identifier: Apache-2.0
// One demo book per page. It can start building before the demo is opened (the landing warms it
// while the visitor reads), so "Open the demo" lands on meeting 12 without replaying 11 meetings
// through the circuits after the tap.
import { DemoEngine } from './engine';

// a macrotask, so the browser can paint and take taps between meetings
const breathe = () => new Promise<void>((r) => setTimeout(r, 0));

type Boot = { engine: DemoEngine; seeded: number; done: boolean; ready: Promise<DemoEngine>; listeners: Set<(n: number) => void> };
let boot: Boot | null = null;

export function bootEngine(): Boot {
  if (boot) return boot;
  const engine = new DemoEngine();
  const b: Boot = { engine, seeded: 0, done: false, ready: Promise.resolve(engine), listeners: new Set() };
  b.ready = (async () => {
    await breathe();
    await engine.seedHistoryInSteps(breathe, (n) => {
      b.seeded = n;
      b.listeners.forEach((f) => f(n));
    });
    b.done = true;
    return engine;
  })();
  boot = b;
  return b;
}
