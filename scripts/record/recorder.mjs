// 参照実装（Scenario Snip の ruby-manager.js）の unit テストを走らせながら、
// computeRubyRanges / resolveRubyVariants の直接の呼び出しと戻り値を JSONL に記録する。
// ruby-manager.js は読み込まれると globalThis（jsdom では window）へ ScenarioSnipRubyManager を代入するため、
// その代入を横取りして関数を包む。包んだ関数の toString は元の関数のソースを返す（書き出し HTML のテストを壊さない）。
import fs from 'node:fs';

const out = process.env.RECORD_OUT;
if (!out) throw new Error('RECORD_OUT を指定してください');
const MAX_VARIANTS_PER_FILE = 1000; // パック全件を引くテスト（数十万回）で JSONL が肥大しないよう、テストファイルごとの上限
let variantCount = 0;
const MAX_DICT = 2000; // 既定の語（約 1 万語）を丸ごと渡すテストは記録しない（パック全体は corpus.jsonl で確かめる）

// 1 呼び出しごとの appendFileSync は、パック全件を引くテストで数十万回になり極端に遅い。溜めてまとめて書く
let buf = [];
function flush() {
  if (buf.length) fs.appendFileSync(out, buf.join(''));
  buf = [];
}
function emit(line) {
  buf.push(line);
  if (buf.length >= 2000) flush();
}
if (typeof afterAll === 'function') afterAll(flush);

function normalizeDict(dict) {
  return dict.map((e) => {
    const out = { text: e && e.text, reading: e && e.reading };
    if (e && typeof e.enabled === 'boolean') out.enabled = e.enabled;
    if (e && typeof e.priority === 'number') out.priority = e.priority;
    return out;
  });
}

function wrap(api) {
  if (!api || api.__recorded) return api;
  const ranges = api.computeRubyRanges;
  const variants = api.resolveRubyVariants;
  const wrappedRanges = function (text, dict) {
    const result = ranges(text, dict);
    if (typeof text === 'string' && Array.isArray(dict) && dict.length <= MAX_DICT) {
      const ok = dict.every((e) => e && typeof e.text === 'string' && typeof e.reading === 'string');
      if (ok) {
        emit(
          JSON.stringify({ kind: 'ranges', dict: normalizeDict(dict), text, expected: result.map((r) => [r.start, r.end, r.reading]) }) + '\n',
        );
      }
    }
    return result;
  };
  wrappedRanges.toString = () => ranges.toString();
  const wrappedVariants = function (text, reading) {
    const result = variants(text, reading);
    if (typeof text === 'string' && typeof reading === 'string' && variantCount < MAX_VARIANTS_PER_FILE) {
      variantCount++;
      emit(JSON.stringify({ kind: 'variants', text, reading, expected: result ?? null }) + '\n');
    }
    return result;
  };
  wrappedVariants.toString = () => variants.toString();
  return { ...api, computeRubyRanges: wrappedRanges, resolveRubyVariants: wrappedVariants, __recorded: true };
}

for (const target of new Set([globalThis, typeof window !== 'undefined' ? window : globalThis])) {
  let current;
  Object.defineProperty(target, 'ScenarioSnipRubyManager', {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (value) => {
      current = wrap(value);
    },
  });
}
