// SPDX-License-Identifier: Apache-2.0
// Write measured Preprod numbers into ui/src/demo/measured.ts.
// usage: node ui/scripts/set-measured.mjs --fee 0.42 --record 18.2 --attest 12.9 --date "2026-10-12, Preprod"
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const file = fileURLToPath(new URL('../src/demo/measured.ts', import.meta.url));
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => (a.startsWith('--') ? [...acc, [a.slice(2), all[i + 1]]] : acc), []),
);
const num = (k) => {
  if (args[k] === undefined) return undefined;
  const v = Number(args[k]);
  if (!Number.isFinite(v) || v < 0) throw new Error(`--${k} must be a non-negative number, got ${args[k]}`);
  return v;
};
const whole = readFileSync(file, 'utf8');
const at = whole.indexOf('export const MEASURED');
if (at < 0) throw new Error('could not find `export const MEASURED` in measured.ts');
const head = whole.slice(0, at);
let src = whole.slice(at); // only edit the values, never the type above them
const set = (re, val) => {
  if (val === undefined) return;
  if (!re.test(src)) throw new Error(`could not find ${re} in measured.ts`);
  src = src.replace(re, (_m, pre) => `${pre}${val}`);
};
set(/(feeDustPerTx: )[^,\n]+/, num('fee'));
set(/(recordMeeting: )[^,\n}]+/, num('record'));
set(/(attestSavings: )[^,\n}]+/, num('attest'));
if (args.date !== undefined) set(/(measuredOn: )[^,\n]+/, JSON.stringify(args.date));
writeFileSync(file, head + src);
console.log(src);
