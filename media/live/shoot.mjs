// SPDX-License-Identifier: Apache-2.0
// The joined-group screens of #/live, from the dev-only fake session (npm run dev; every figure
// is made up and nothing reaches Preprod). 390x844 at 2x into media/live/.
//   cd ui && npx vite --port 5179 &   node media/live/shoot.mjs http://localhost:5179/
// PLAYWRIGHT=/path/to/playwright/index.mjs selects a Playwright install outside this repo.
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const base = process.argv[2] ?? 'http://localhost:5179/';
const out = fileURLToPath(new URL('.', import.meta.url));
const A = 'ab'.repeat(32), G = '01'.repeat(32), M = 'cd'.repeat(32);
const invite = `u1.${A}.${G}.0.${M}.${btoa('http://localhost:3001').replace(/=+$/, '')}`;
const b = await chromium.launch();
const page = async (hash) => {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto(base + hash);
  await p.evaluate(() => document.fonts.ready);
  return p;
};
const at = (p, sel, block = 'start') => p.evaluate(([s, k]) => document.querySelector(s).scrollIntoView({ block: k }), [sel, block]);
const shot = (p, name) => p.screenshot({ path: `${out}${name}.png` });

// member: invite, PIN, passbook, refused proof, sent, proof slip
let p = await page(`#/live?fake=1&step=900&invite=${invite}`);
await p.getByRole('button', { name: 'Check my Lace setup' }).click();
await p.getByTestId('invite-join').waitFor();
await p.getByLabel('6-digit PIN for this phone').fill('482916');
await at(p, '[data-testid=invite-join]');
await shot(p, 'member-1-join');
await p.getByRole('button', { name: 'Join this group' }).click();
await p.getByTestId('live-group').waitFor();
await p.getByRole('button', { name: 'Open my passbook' }).click();
await p.getByTestId('opened').waitFor();
await at(p, '[data-testid=live-group]');
await shot(p, 'member-2-passbook');
await p.getByTestId('live-min').fill('30');
await p.getByRole('button', { name: 'Make a proof slip' }).click();
await p.getByTestId('write-err').filter({ hasText: 'Not enough shares' }).waitFor();
await at(p, '[data-testid=write-err]', 'center');
await shot(p, 'member-3-refused');
await p.getByTestId('live-min').fill('29');
await p.getByRole('button', { name: 'Make a proof slip' }).click();
await p.getByTestId('sent').waitFor({ timeout: 20000 });
await at(p, '[data-testid=sent]', 'center');
await shot(p, 'member-4-sent');
await p.getByTestId('write-out').filter({ hasText: 'Proof slip on the book' }).waitFor({ timeout: 20000 });
await at(p, '[data-testid=write-out]', 'center');
await shot(p, 'member-5-proof');
await p.close();

// secretary: meeting sheet, stamps to hand out
p = await page('#/live?fake=1&step=500');
await p.getByRole('button', { name: 'Check my Lace setup' }).click();
await p.getByLabel('Group fee-key relay URL').fill('http://localhost:3001');
await p.getByLabel('the secretary').check();
await p.getByLabel('Secretary secret').fill(M);
await p.getByLabel('Group secret').fill(G);
await p.getByLabel('6-digit PIN for this phone').fill('482916');
await p.getByRole('button', { name: 'Join this group' }).click();
await p.getByTestId('live-group').waitFor();
await p.getByLabel('Slot 0 shares').fill('3');
await p.getByLabel('Slot 4 loan issued').fill('100');
await at(p, '[data-testid=live-group]');
await shot(p, 'secretary-2-sheet');
await p.getByRole('button', { name: 'Stamp and record meeting 13' }).click();
await p.getByTestId('stamps').waitFor({ timeout: 20000 });
await at(p, '[data-testid=stamps]', 'center');
await shot(p, 'secretary-4-stamps');
await p.close();
await b.close();
