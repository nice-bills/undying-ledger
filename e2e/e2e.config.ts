// SPDX-License-Identifier: Apache-2.0
// e2e (tester.army) config for Undying Ledger. Scaffolded with `npx e2e init --yes e2e`, then:
//   * the runner serves the built demo (../docs) itself with serve.mjs on a free port;
//   * two phone-sized targets, 390x844 and 430x932;
//   * E2E_CDP=<ws/http DevTools URL> attaches to an already running Chromium instead of
//     launching one (used on machines where Playwright cannot download its browser, e.g.
//     linux-arm64 sandboxes);
//   * the agent model is optional. The deterministic tests need no model; the agentic smoke
//     test runs only when AI_GATEWAY_API_KEY is set.
import type { E2EConfig } from 'e2e';
import { web } from '@e2e-dev/web';
import { gateway } from 'ai';

const cdp = process.env.E2E_CDP;
/** Accept either a ws:// DevTools URL or the http:// debugging port; resolve the latter to its ws URL. */
const resolveCdp = async (): Promise<string> => {
  if (!cdp || cdp.startsWith('ws')) return cdp ?? '';
  const res = await fetch(new URL('/json/version', cdp));
  return ((await res.json()) as { webSocketDebuggerUrl: string }).webSocketDebuggerUrl;
};
const engine = (width: number, height: number) =>
  web({ viewport: { width, height }, ...(cdp ? { connect: { cdpEndpoint: resolveCdp } } : {}) });

const app = {
  url: process.env.APP_URL ?? 'http://127.0.0.1:0',
  ...(process.env.APP_URL
    ? {}
    : { command: { executable: 'node', args: ['serve.mjs', '{port}', process.env.E2E_SITE_DIR ?? '../docs'], log: '.e2e/logs/app.log' } }),
};

export default {
  agents: {
    default: {
      // Vercel AI Gateway; reads AI_GATEWAY_API_KEY. Only the agentic smoke test uses it.
      model: gateway(process.env.E2E_MODEL ?? 'openai/gpt-6-luna-fast'),
      system: 'You are a thorough QA agent testing a savings-group record book. Verify every outcome against what is on screen.',
    },
  },
  targets: [
    { name: 'phone-390', engine: engine(390, 844), app },
    { name: 'phone-430', engine: engine(430, 932), app },
  ],
  timeout: 120_000,
  // stamps, pen strokes and loose paper settle after each circuit run; give them time to land
  assertionTimeout: 20_000,
} satisfies E2EConfig;
