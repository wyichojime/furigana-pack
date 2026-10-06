// data/*.json（パック）から data/compiled/*.json（解釈済みの形）を作る。--check は書かずに最新かだけを見る。
// 照合の決まりと同じ実装（dist/furigana-pack.mjs の buildMatcher）で作るため、先に npm run build が要る。
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toCompiledLines } from './compiled-format.mjs';

const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const { buildMatcher } = await import(pathToFileURL(path.join(lib, 'dist', 'furigana-pack.mjs')).href);
const PACKS = ['ruby-pack.json'];
let stale = 0;

for (const pack of PACKS) {
  const raw = fs.readFileSync(path.join(lib, 'data', pack), 'utf8').replace(/\r\n/g, '\n');
  const { groups } = buildMatcher(JSON.parse(raw).rubyDictionary);
  const head = {
    format: 'furigana-pack-compiled',
    version: 1,
    source: pack,
    sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    groupCount: groups.length,
  };
  const lines = toCompiledLines(head, groups);
  const contents = lines.join('\n') + '\n';
  const out = path.join(lib, 'data', 'compiled', pack);
  const current = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : null;
  if (check) {
    if (current !== contents) {
      console.error(`data/compiled/${pack} が最新ではありません。npm run compile:data を実行してください。`);
      stale += 1;
    }
  } else {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, contents);
    console.log(`data/compiled/${pack}: ${groups.length} 照合単位`);
  }
}
if (stale) process.exit(1);
