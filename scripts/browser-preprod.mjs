// SPDX-License-Identifier: Apache-2.0
// The no-wallet path of #/live, in a real browser, against a group on Preprod: a member opens her
// invite link, joins with a 6-digit PIN and no wallet, keeps her stamp, makes a proof slip, votes,
// then leaves ("Join as someone else") and joins again with typed secrets and the same PIN. The page proves on the local proof
// server, binds with a burner key and sends each call to the relay. Needs the built app served
// locally, the proof server on :6300, the relay on :3001 for the group, BLOCKFROST_PROJECT_ID, and
// the group's JSON (written by the deploy script). The token is typed into the page, never printed.
//
//   GROUP_JSON=.preprod/group3.json SLOT=3 STAMP=undying-stamp:3:2:4:0 \
//   node scripts/browser-preprod.mjs http://localhost:4179/ > .preprod/browser-run.json
import { readFileSync } from 'node:fs';
const { chromium } = await import(process.env.PW_MODULE ?? 'playwright');

const base = process.argv[2] ?? 'http://localhost:4179/';
const token = process.env.BLOCKFROST_PROJECT_ID;
if (!token) throw new Error('Missing env BLOCKFROST_PROJECT_ID');
const g = JSON.parse(readFileSync(process.env.GROUP_JSON ?? '.preprod/group3.json', 'utf8'));
const slot = Number(process.env.SLOT ?? 3);
const relay = process.env.RELAY_URL ?? 'http://localhost:3001';
const T = { timeout: 300_000 };
const redact = (s) => String(s).split(token).join('***');
const PIN = '482916';
// the invite format of chain/src/invite.ts (u1.contract.group.slot.secret.relay); the token stays out of it
const b64url = (x) => btoa(x).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const invite = ['u1', g.contract, g.groupSecret, String(slot), g.memberSecrets[slot], b64url(relay)].join('.');

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
p.on('pageerror', (e) => errors.push(redact(e)));
p.on('console', (m) => m.type() === 'error' && errors.push(redact(m.text())));
const sponsored = [];
p.on('response', async (r) => {
  if (r.url().startsWith(relay) && r.url().endsWith('/sponsor')) sponsored.push({ status: r.status(), body: await r.json().catch(() => null) });
});

const out = { base, contract: g.contract, slot, steps: {}, errors };
const live = p.getByTestId('live');
const wait = async (label, f) => {
  const t0 = Date.now();
  await f();
  out.steps[label] = { seconds: (Date.now() - t0) / 1000 };
};
try {
  await p.goto(`${base}#/live?invite=${invite}`);
  out.inviteLeftInUrl = (await p.evaluate(() => location.href)).includes('invite=');
  await live.getByLabel('Blockfrost Preprod project ID (only without Lace)').fill(token);
  await live.getByRole('button', { name: 'Use without a wallet' }).click();
  await live.getByTestId('live-write').waitFor(T);
  await live.getByTestId('invite-join').waitFor(T);
  await live.getByLabel('6-digit PIN for this phone').fill(PIN);
  await wait('join', async () => {
    await live.getByRole('button', { name: 'Join this group' }).click();
    await live.getByTestId('live-group').waitFor(T);
  });
  if (process.env.STAMP) {
    await live.getByLabel('Stamp from the secretary').fill(process.env.STAMP);
    await wait('keep stamp', async () => {
      await live.getByRole('button', { name: 'Keep this stamp' }).click();
      await live.getByTestId('opened').waitFor(T);
    });
  }
  await wait('attestSavings', async () => {
    const t0 = Date.now();
    await live.getByRole('button', { name: 'Make a proof slip' }).click();
    // "sent" shows once the relay answers, before Midnight.js sees the tx on the indexer
    const sent = p.getByTestId('sent').waitFor(T).then(() => (out.steps.attestSavingsSentSeconds = (Date.now() - t0) / 1000)).catch(() => undefined);
    await p.getByTestId('write-out').filter({ hasText: 'Proof slip on the book' }).waitFor(T);
    await Promise.race([sent, new Promise((r) => setTimeout(r, 100))]);
  });
  out.steps.attestSavings.message = await p.getByTestId('write-out').textContent();
  const candidate = Array.from(crypto.getRandomValues(new Uint8Array(32)), (x) => x.toString(16).padStart(2, '0')).join('');
  await live.getByLabel('Secretary key of the one standing').fill(candidate);
  await wait('voteSecretary', async () => {
    await live.getByRole('button', { name: 'Vote for this secretary' }).click();
    await p.getByTestId('write-out').filter({ hasText: /Vote on the book|majority/ }).waitFor(T);
  });
  out.steps.voteSecretary.message = await p.getByTestId('write-out').textContent();
  // Someone else on this phone, then her again: typed secrets and the same PIN open the same passbook.
  await live.getByTestId('leave').click();
  await live.getByLabel('My member secret').fill(g.memberSecrets[slot]);
  await live.getByLabel('Group secret').fill(g.groupSecret);
  await live.getByLabel('My slot').fill(String(slot));
  await live.getByLabel('6-digit PIN for this phone').fill(PIN);
  await wait('rejoin with the same PIN', async () => {
    await live.getByRole('button', { name: 'Join this group' }).click();
    await live.getByTestId('live-group').waitFor(T);
    await live.getByRole('button', { name: 'Open my passbook' }).click();
    await live.getByTestId('opened').waitFor(T);
  });
  out.steps['rejoin with the same PIN'].message = await p.getByTestId('write-out').textContent();
  out.ok = true;
} catch (e) {
  out.ok = false;
  out.failure = redact(e?.message ?? e).slice(0, 2000);
  out.writeErr = redact((await p.getByTestId('write-err').textContent().catch(() => '')) ?? '');
  out.status = redact((await p.getByTestId('lace-status').textContent().catch(() => '')) ?? '');
}
out.sponsored = sponsored;
console.log(JSON.stringify(out, null, 2));
await browser.close();
