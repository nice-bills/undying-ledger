// SPDX-License-Identifier: Apache-2.0
// WASM handling adapted from midnightntwrk/example-bboard bboard-ui/vite.config.ts (Apache-2.0).
import { createReadStream, existsSync, statSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';

// `npm run dev` only: serve the proving keys and ZKIR from `compact compile` at /zk/, where the
// live page's FetchZkConfigProvider looks by default. They are large and never go into docs/.
const ZK_DIR = resolve(__dirname, '../contract/src/managed/undying');
const serveZk = (): Plugin => ({
  name: 'undying-serve-zk',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/zk', (req, res, next) => {
      const file = resolve(ZK_DIR, '.' + decodeURIComponent((req.url ?? '/').split('?')[0]));
      if (!file.startsWith(ZK_DIR + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
      res.setHeader('content-type', 'application/octet-stream');
      createReadStream(file).pipe(res);
    });
  },
});

export default defineConfig({
  base: './', // static, relocatable build (GitHub Pages / IPFS)
  plugins: [react(), wasm(), serveZk()], // target esnext keeps native top-level await
  build: { target: 'esnext', outDir: 'dist', emptyOutDir: true },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/onchain-runtime-v3'],
  },
  test: { environment: 'node' },
} as never);
