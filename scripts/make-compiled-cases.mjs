// unit.jsonl・random.jsonl の各ケースの辞書を解釈済みの形にした tests/conformance/compiled-cases.jsonl を作る。
// C# 版など、記法を解釈しない実装の一致テスト用。期待値は元のケース（参照実装で作ったもの）をそのまま写す。
// あわせて render-cases.jsonl（toAozora・toHtml の期待値）の辞書を解釈済みの形にした compiled-render-cases.jsonl も作る。
// 先に npm run build が要る（dist/furigana-pack.mjs の buildMatcher を使う）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toCompiledLines } from './compiled-format.mjs';

const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const confDir = path.join(lib, 'tests', 'conformance');
const { buildMatcher } = await import(pathToFileURL(path.join(lib, 'dist', 'furigana-pack.mjs')).href);

const rows = [];
for (const file of ['unit.jsonl', 'random.jsonl']) {
  for (const line of fs.readFileSync(path.join(confDir, file), 'utf8').split('\n').filter(Boolean)) {
    const c = JSON.parse(line);
    const { groups } = buildMatcher(c.dict ?? []);
    const head = { format: 'furigana-pack-compiled', version: 1, source: c.id, groupCount: groups.length };
    rows.push(JSON.stringify({ id: c.id, compiled: toCompiledLines(head, groups), text: c.text, expected: c.expected }));
  }
}
fs.writeFileSync(path.join(confDir, 'compiled-cases.jsonl'), rows.join('\n') + '\n');
console.log(`compiled-cases.jsonl: ${rows.length} 件`);

const renderRows = [];
for (const line of fs.readFileSync(path.join(confDir, 'render-cases.jsonl'), 'utf8').split('\n').filter(Boolean)) {
  const c = JSON.parse(line);
  const { groups } = buildMatcher(c.dict);
  const head = { format: 'furigana-pack-compiled', version: 1, source: c.id, groupCount: groups.length };
  renderRows.push(JSON.stringify({ id: c.id, compiled: toCompiledLines(head, groups), text: c.text, aozora: c.aozora, html: c.html }));
}
fs.writeFileSync(path.join(confDir, 'compiled-render-cases.jsonl'), renderRows.join('\n') + '\n');
console.log(`compiled-render-cases.jsonl: ${renderRows.length} 件`);
