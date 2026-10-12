// SPDX-License-Identifier: Apache-2.0
// One pino logger for the chain scripts that strips the Blockfrost token from every message.
// testkit-js logs the wallet config, including the indexer URLs with ?project_id=, through the
// logger we hand it, so redaction has to happen here rather than at our own call sites.

import pino, { type Logger } from 'pino';
import { logger as testkitLogger } from '@midnight-ntwrk/testkit-js';
import { redactToken } from './config.js';

const scrub = (a: unknown): unknown => (typeof a === 'string' ? redactToken(a) : a);

// testkit's own module logger (stdout plus logs/tests/*.log) and polkadot's RPC-CORE console lines
// both print the RPC and indexer URLs with the token, so wrap them once at import.
for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const) {
  const orig = testkitLogger[level].bind(testkitLogger) as (...a: unknown[]) => void;
  (testkitLogger as unknown as Record<string, unknown>)[level] = (...a: unknown[]) => orig(...a.map(scrub));
}
for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  const orig = console[level].bind(console);
  console[level] = (...a: unknown[]) => orig(...a.map(scrub));
}

export const makeLogger = (level = 'info'): Logger =>
  pino({
    level,
    hooks: {
      logMethod(args, method) {
        method.apply(this, args.map(scrub) as Parameters<typeof method>);
      },
    },
  });
