// 一致テストのデータを作る。期待値はすべて参照実装（Scenario Snip の ruby-manager.js）のもの。
// 使い方: node scripts/make-conformance.mjs --reference <Scenario Snip のリポジトリ> [--reference-commit <sha>]
// 先に scripts/record/ で _recorded.jsonl を作っておく（手順は tests/conformance/README.md）。
// パックだけを直したときは、これではなく npm run conformance:packs（make-pack-conformance.mjs）を使う。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { mulberry32, makeRandomCase, toTuples, makePackExpectations, writeJsonl as writeJsonlTo, writePackExpectations } from './conformance-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = path.resolve(here, '..');
const confDir = path.join(lib, 'tests', 'conformance');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function writeJsonl(file, rows) {
  fs.writeFileSync(path.join(confDir, file), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${file}: ${rows.length} 件`);
}

function fromRecorded() {
  const recorded = path.join(confDir, '_recorded.jsonl');
  if (!fs.existsSync(recorded)) {
    throw new Error(
      `${recorded} がありません。先に参照実装の unit テストを記録してください（手順は tests/conformance/README.md の「作り直し」）。`,
    );
  }
  const lines = fs.readFileSync(recorded, 'utf8').split('\n').filter(Boolean);
  const seen = new Set();
  const unit = [];
  const variants = [];
  for (const line of lines) {
    const row = JSON.parse(line);
    const key = line; // 同じ呼び出し・同じ結果は 1 件にする
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.kind === 'ranges') {
      unit.push({ id: `unit-${String(unit.length + 1).padStart(4, '0')}`, dict: row.dict, text: row.text, expected: row.expected });
    } else if (row.kind === 'variants') {
      variants.push({ id: `variants-${String(variants.length + 1).padStart(4, '0')}`, text: row.text, reading: row.reading, expected: row.expected });
    }
  }
  return { unit, variants };
}

/** 参照実装を読み込む（クラシックスクリプト。globalThis へ ScenarioSnipRubyManager を代入する） */
function loadReference(ssDir) {
  const file = path.join(ssDir, '_app', 'lib', 'app', 'ruby-manager.js');
  vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
  const api = globalThis.ScenarioSnipRubyManager;
  if (!api || typeof api.computeRubyRanges !== 'function') throw new Error('参照実装を読み込めませんでした');
  return api;
}

const reference = arg('--reference');
if (!reference) throw new Error('--reference <Scenario Snip のリポジトリ> を指定してください');
const referenceCommit = arg('--reference-commit') ?? '1285956';
const { unit, variants } = fromRecorded();
const ref = loadReference(reference); // 書き始める前に読み込みを確かめる
writeJsonl('unit.jsonl', unit);

// 乱数のケース（種 20261002 から 3,000 件）
const rand = mulberry32(20261002);
const random = [];
for (let i = 0; i < 3000; i++) {
  const c = makeRandomCase(rand, `random-${String(i + 1).padStart(4, '0')}`);
  random.push({ ...c, expected: toTuples(ref.computeRubyRanges(c.text, c.dict)) });
  // 記法の解釈も、乱数の辞書の全語で確かめる
  for (const e of c.dict) {
    variants.push({ id: `variants-r${String(variants.length + 1).padStart(5, '0')}`, text: e.text, reading: e.reading, expected: ref.resolveRubyVariants(e.text, e.reading) ?? null });
  }
}
writeJsonl('random.jsonl', random);
writeJsonl('variants.jsonl', variants);

// 実際のパックと本文
writePackExpectations(
  confDir,
  makePackExpectations(lib, {
    prepare: (dict) => (text) => ref.computeRubyRanges(text, dict),
    resolve: (text, reading) => ref.resolveRubyVariants(text, reading),
  }),
);
fs.writeFileSync(
  path.join(confDir, 'meta.json'),
  JSON.stringify(
    {
      referenceRepo: 'Scenario_Snip_v1.x',
      referenceCommit,
      referenceFile: '_app/lib/app/ruby-manager.js',
      generatedAt: new Date().toISOString().slice(0, 10),
    },
    null,
    2,
  ) + '\n',
);
