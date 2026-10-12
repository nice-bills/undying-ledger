// SPDX-License-Identifier: Apache-2.0
// Copy the PUBLIC fields of a Preprod run into ui/src/demo/preprod.ts.
// usage: node ui/scripts/set-preprod.mjs .preprod/group.json .preprod/measure.json
// group.json also holds the group's secrets; only `contract`, `deployTxHash` and `deployedAt` are read.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const [groupPath, measurePath] = process.argv.slice(2);
if (!groupPath || !measurePath) throw new Error('usage: set-preprod.mjs <group.json> <measure.json>');
const g = JSON.parse(readFileSync(groupPath, 'utf8'));
const m = JSON.parse(readFileSync(measurePath, 'utf8'));
const hex = (v, what) => {
  if (typeof v !== 'string' || !/^[0-9a-f]+$/i.test(v)) throw new Error(`${what} is not hex`);
  return v.toLowerCase();
};
const tx = (t, what) => ({ txHash: hex(t.txHash, `${what}.txHash`), feeDust: String(t.feeDust), proofSeconds: Number(t.proofSeconds) });
const run = {
  network: 'preprod',
  contract: hex(g.contract, 'contract'),
  deployTxHash: g.deployTxHash ? hex(g.deployTxHash, 'deployTxHash') : null,
  deployedAt: g.deployedAt ?? null,
  paidBy: String(m.paidBy),
  callerDustSpeck: { before: String(m.callerDustSpeck.before), after: String(m.callerDustSpeck.after) },
  recordMeeting: tx(m.recordMeeting, 'recordMeeting'),
  attestSavings: tx(m.attestSavings, 'attestSavings'),
  measuredAt: String(m.measuredAt),
};
if (hex(m.contract, 'measure.contract') !== run.contract) throw new Error('measure.json is for a different contract');
const file = fileURLToPath(new URL('../src/demo/preprod.ts', import.meta.url));
const src = readFileSync(file, 'utf8');
const re = /export const PREPROD_RUN: PreprodRun \| null = [\s\S]*?;\n\n/;
if (!re.test(src)) throw new Error('could not find PREPROD_RUN in preprod.ts');
writeFileSync(file, src.replace(re, `export const PREPROD_RUN: PreprodRun | null = ${JSON.stringify(run, null, 2)};\n\n`));
console.log(JSON.stringify(run, null, 2));
