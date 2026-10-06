import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// パッケージ名 furigana-pack での読み込み（package.json の exports）を、Node の自己参照で確かめる。
// npm test はビルドしてから流すため、dist/ はある前提。
const root = path.resolve(__dirname, '..', '..');
const run = (code: string) =>
  execFileSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8' }).trim();

describe('package.json の exports', () => {
  it('furigana-pack で入口の関数を読み込める', () => {
    const names = run("const m = await import('furigana-pack'); console.log(Object.keys(m).sort().join(','));").split(',');
    for (const n of ['loadDictionary', 'createAnnotator', 'rangesToHtml', 'rangesToAozora', 'resolveVariants', 'buildMatcher', 'matchRanges', 'computeRubyRanges', 'matcherFromCompiled', 'indexMatcherGroups']) {
      expect(names).toContain(n);
    }
  });

  it('furigana-pack/global・furigana-pack/data/* の場所を引ける', () => {
    const out = run(
      "console.log([import.meta.resolve('furigana-pack/global'), import.meta.resolve('furigana-pack/data/ruby-pack.json')].join('\\n'));",
    ).split('\n');
    expect(out[0]).toMatch(/\/dist\/furigana-pack\.global\.js$/);
    expect(out[1]).toMatch(/\/data\/ruby-pack\.json$/);
  });

  it('使う側から型が通る（tests/types を tsc にかける。誤った使い方はエラーになる）', () => {
    expect(() =>
      execFileSync(process.execPath, [path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'), '-p', 'tests/types/tsconfig.json'], {
        cwd: root,
        encoding: 'utf8',
      }),
    ).not.toThrow();
  }, 60_000);
});
