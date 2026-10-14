// SPDX-License-Identifier: Apache-2.0
// Invite links and QR codes for a deployed group, from the secrets file the deploy wrote.
//
//   GROUP=.preprod/group.json RELAY_URL=http://192.168.1.20:3001 npm run invites -w chain
//
// Writes one page (default .preprod/invites.html, mode 600) with a QR card per person: the
// secretary and each member slot. Prints only the path and the count; the links carry the
// members' secrets and never go to the terminal. Print the page at the meeting, let each member
// scan her own card, then destroy the paper. Optional:
//   APP_URL     where the app is served (default https://nice-bills.github.io/undying-ledger/)
//   INVITE_BLOCKFROST=1  put BLOCKFROST_PROJECT_ID into each link (no-wallet members need one;
//                        anyone holding a link can then use that project's quota)
//   PROVER_URL  the group's proof server (https, e.g. the secretary's laptop behind a tunnel), so
//               members on phones can prove; their private inputs go to it
//   OUT         another output file
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { inviteUrl, type Invite } from '../invite.js';

const cwd = process.env['INIT_CWD'] ?? process.cwd();
const groupFile = path.resolve(cwd, process.env['GROUP'] ?? '.preprod/group.json');
const out = path.resolve(cwd, process.env['OUT'] ?? path.join(path.dirname(groupFile), 'invites.html'));
const app = process.env['APP_URL'] ?? 'https://nice-bills.github.io/undying-ledger/';
const relay = process.env['RELAY_URL'] || undefined;
const prover = process.env['PROVER_URL'] || undefined;
const blockfrost = process.env['INVITE_BLOCKFROST'] === '1' ? process.env['BLOCKFROST_PROJECT_ID'] : undefined;
if (process.env['INVITE_BLOCKFROST'] === '1' && !blockfrost) throw new Error('INVITE_BLOCKFROST=1 needs BLOCKFROST_PROJECT_ID');

const g = JSON.parse(readFileSync(groupFile, 'utf8')) as { contract: string; groupSecret: string; secretarySecret: string; memberSecrets: string[] };
const base = { contract: g.contract, groupSecret: g.groupSecret, relay, blockfrost, prover };
const people: { who: string; invite: Invite }[] = [
  { who: 'Secretary', invite: { ...base, role: 'secretary', slot: 0, mySecret: g.secretarySecret } },
  ...g.memberSecrets.map((mySecret, slot) => ({ who: `Member, slot ${slot}`, invite: { ...base, role: 'member' as const, slot, mySecret } })),
];

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const cards = await Promise.all(
  people.map(async ({ who, invite }) => {
    const url = inviteUrl(app, invite);
    const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#10261E', light: '#FFF9EE' } });
    return `<section><h2>${esc(who)}</h2>${svg}<p>Scan with the phone camera, open the link, choose a 6-digit PIN.</p><details><summary>Link</summary><code>${esc(url)}</code></details></section>`;
  }),
);

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invites: group ${esc(g.contract.slice(0, 8))}</title>
<style>
body{margin:0;padding:24px 16px;background:#F3EEE4;color:#10261E;font:16px/1.4 system-ui,sans-serif}
h1{font-size:22px;margin:0 0 4px}
.warn{max-width:60ch;margin:0 0 20px}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
section{background:#FFF9EE;border:1px solid #D9D0BE;border-radius:16px;padding:16px;break-inside:avoid}
h2{font-size:18px;margin:0 0 8px}
svg{width:100%;height:auto;display:block}
code{word-break:break-all;font-size:11px}
@media print{body{background:#fff}.warn{display:none}}
</style></head><body>
<h1>Invites for group ${esc(g.contract.slice(0, 8))}…</h1>
<p class="warn">Each card is that person's key to the book: whoever scans it can act as her. Hand each card to its owner only, and destroy the paper after the meeting.${blockfrost ? ' These links also carry the Blockfrost project ID.' : ''}${relay ? '' : ' No relay URL is set, so each member types it on the page.'}</p>
<main>${cards.join('\n')}</main>
</body></html>
`;
writeFileSync(out, page, { mode: 0o600 });
console.log(`Wrote ${people.length} invites (1 secretary, ${g.memberSecrets.length} members) to ${path.relative(cwd, out)}`);
