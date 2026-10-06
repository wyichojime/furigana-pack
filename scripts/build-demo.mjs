// Web デモの配信物を dist-demo/ に組み立てる。main.ts・worker.ts を esbuild で（ライブラリのソースごと）束ね、
// 画面・パック（worker.js が読む）・パックのライセンス・_headers（Cloudflare のヘッダー定義）・robots.txt を置く。
//   node scripts/build-demo.mjs              … ステージング用（検索に載せない）
//   node scripts/build-demo.mjs --production … 本番（furigana.wyichojime.com）用
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const production = process.argv.includes('--production');
const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(lib, 'dist-demo');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'data'), { recursive: true });
await esbuild.build({
  absWorkingDir: lib,
  entryPoints: { demo: 'demo/src/main.ts', worker: 'demo/src/worker.ts' },
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  charset: 'utf8',
  outdir: out,
  logLevel: 'warning',
  banner: { js: '/*! furigana-pack demo | MIT License | Copyright (c) 2026 wyichojime */' },
});
const packPath = path.join(lib, 'data', 'ruby-pack.json');
// 足元の「更新」の日付は、組み立てた日（日本時間）
const updated = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
for (const page of ['index.html', 'licenses.html']) {
  const html = fs.readFileSync(path.join(lib, 'demo', page), 'utf8').replace('%CSP%', CSP).replace('%UPDATED%', updated);
  fs.writeFileSync(path.join(out, page), html);
}
fs.copyFileSync(path.join(lib, 'demo', 'demo.css'), path.join(out, 'demo.css'));
fs.copyFileSync(packPath, path.join(out, 'data', 'ruby-pack.json'));
// ライセンスは .txt で置く（拡張子が無いとブラウザが表示せずにダウンロードするため）
fs.copyFileSync(path.join(lib, 'data', 'LICENSE'), path.join(out, 'data', 'LICENSE.txt'));
fs.writeFileSync(
  path.join(out, '_headers'),
  `/*\n  Cache-Control: public, max-age=0, must-revalidate\n  Content-Security-Policy: ${CSP}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n` +
    (production ? '' : '  X-Robots-Tag: noindex\n'),
);
fs.writeFileSync(path.join(out, 'robots.txt'), production ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
console.log(`dist-demo/ を組み立てました（${production ? '本番' : 'ステージング'}）`);
