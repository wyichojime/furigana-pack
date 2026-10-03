// パックに依存する一致テストの期待値（tests/conformance/corpus.jsonl と variants-packs.json）だけを作り直す。
// 使い方: npm run conformance:packs（先にビルドし、このリポジトリの dist/furigana-pack.mjs で期待値を作る）
//
// 期待値をこのライブラリ自身で作ってよい理由: 照合と記法の解釈の決まりは、参照実装（Scenario Snip）で作った
// unit.jsonl・random.jsonl・variants.jsonl で固定している。それらが通る限り、パックを直したときの
// パックに依存する期待値はこのライブラリで作ってよい（参照実装はもう照合を持たず、作り直せないため）。
// id と形式は make-conformance.mjs と同じ（共有の makePackExpectations を使う）なので、パックが変わらなければ
// 作り直した 2 ファイルはバイト単位で同じになる。
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makePackExpectations, writePackExpectations } from './conformance-lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const lib = path.resolve(here, '..');
const confDir = path.join(lib, 'tests', 'conformance');
const { buildMatcher, matchRanges, resolveVariants } = await import(pathToFileURL(path.join(lib, 'dist', 'furigana-pack.mjs')).href);

writePackExpectations(
  confDir,
  makePackExpectations(lib, {
    prepare: (dict) => {
      const m = buildMatcher(dict);
      return (text) => matchRanges(m, text);
    },
    resolve: resolveVariants,
  }),
);
