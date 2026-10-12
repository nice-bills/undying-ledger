// SPDX-License-Identifier: Apache-2.0
// Copy the proving keys and ZKIR from `npm run compact` into docs/zk/, where #/live's
// FetchZkConfigProvider looks (next to index.html), so members can prove from the public Pages link.
// Missing keys are not fatal: the simulator demo needs none, and #/live says it cannot prove.
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const src = fileURLToPath(new URL('../contract/src/managed/undying/', import.meta.url));
const out = fileURLToPath(new URL('../docs/zk/', import.meta.url));
if (!existsSync(src + 'keys/recordMeeting.prover')) {
  console.warn('copy-zk: no proving keys (run `npm run compact`); docs/zk/ not written');
  process.exit(0);
}
mkdirSync(out, { recursive: true });
for (const d of ['keys', 'zkir']) cpSync(src + d, out + d, { recursive: true });
console.log('copy-zk: docs/zk/keys and docs/zk/zkir written');
