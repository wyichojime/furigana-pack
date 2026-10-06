// dist/ に 2 つの配布の形を作る: ES modules 版と、<script> で読める 1 ファイル版（グローバル FuriganaPack）。
// 関数のソースが書き出し HTML へ埋め込まれるため、圧縮（minify）と名前の保持用の補助（keepNames）は使わない。
import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const common = {
  absWorkingDir: lib,
  entryPoints: ['src/index.ts'],
  bundle: true,
  target: 'es2020',
  charset: 'utf8',
  banner: { js: '/*! furigana-pack | MIT License | Copyright (c) 2026 wyichojime */' },
  logLevel: 'warning',
};
await esbuild.build({ ...common, format: 'esm', platform: 'neutral', outfile: 'dist/furigana-pack.mjs' });
await esbuild.build({
  ...common,
  format: 'iife',
  platform: 'browser',
  globalName: 'FuriganaPack',
  outfile: 'dist/furigana-pack.global.js',
  footer: { js: 'globalThis.FuriganaPack = FuriganaPack;' },
});
console.log('dist/furigana-pack.mjs, dist/furigana-pack.global.js');
