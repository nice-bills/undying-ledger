// SPDX-License-Identifier: Apache-2.0
// static server: /stage/* from the stage dir, everything else from the built app (docs/)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const [port, appDir, stageDir] = process.argv.slice(2);
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
    let root = appDir;
    if (p.startsWith('stage/') || p === 'stage') { root = stageDir; p = p.slice(6); }
    let f = join(root, p);
    if ((await stat(f).catch(() => null))?.isDirectory()) f = join(f, 'index.html');
    const b = await readFile(f);
    res.writeHead(200, { 'content-type': T[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(b);
  } catch { res.writeHead(404); res.end('nf'); }
}).listen(Number(port), '127.0.0.1');
