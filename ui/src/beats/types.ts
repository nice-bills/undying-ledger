// SPDX-License-Identifier: Apache-2.0
import type { DemoEngine } from '../demo/engine';

export type BeatProps = {
  e: DemoEngine;
  /** True once this beat is on screen and its page turn has finished. */
  active: boolean;
  go: (n: number) => void;
  announce: (msg: string) => void;
};

/** The runtime prefixes contract assertion messages; show the contract's own words. */
export const contractWords = (msg: string) => msg.replace(/^.*failed assert:\s*/i, '').replace(/\.$/, '');
