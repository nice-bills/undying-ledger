// SPDX-License-Identifier: Apache-2.0
// WASM handling adapted from midnightntwrk/example-bboard bboard-ui/vite.config.ts (Apache-2.0).
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

export default defineConfig({
  base: './', // static, relocatable build (GitHub Pages / IPFS)
  plugins: [react(), wasm()], // target esnext keeps native top-level await
  build: { target: 'esnext', outDir: 'dist', emptyOutDir: true },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/onchain-runtime-v3'],
  },
  test: { environment: 'node' },
} as never);
