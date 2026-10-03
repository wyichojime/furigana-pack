import path from 'node:path';
import vm from 'node:vm';
import * as esbuild from 'esbuild';
import { describe, expect, it } from 'vitest';
import { dictOf, readJsonl, toTuples, type RangeCase } from './conformance-helpers';

const NAMES = ['parseParenAlternation', 'parseSegmentedReading', 'resolveVariants', 'buildMatcher', 'matchRanges', 'computeRubyRanges', 'indexMatcherGroups'] as const;

describe('関数のソースだけで動く（RUBY-004 の書き出し HTML と同じ条件）', () => {
  it('束ねた 7 関数の toString を新しい関数の中で評価しても、一致テストと同じ結果になる', () => {
    const built = esbuild.buildSync({
      absWorkingDir: path.resolve(__dirname, '..', '..'),
      entryPoints: ['src/core/index.ts'],
      bundle: true,
      write: false,
      format: 'iife',
      globalName: 'Core',
      target: 'es2020',
      charset: 'utf8',
    });
    const sandbox: Record<string, unknown> = {};
    vm.runInNewContext(built.outputFiles[0].text, sandbox);
    const core = sandbox.Core as Record<string, (...a: unknown[]) => unknown>;
    const src = NAMES.map((n) => core[n].toString()).join('\n');
    const isolated = new Function(`${src}\nreturn { computeRubyRanges };`)() as {
      computeRubyRanges: (text: string, dict: unknown[]) => { start: number; end: number; reading: string }[];
    };
    for (const c of readJsonl<RangeCase>('random.jsonl').slice(0, 500)) {
      expect(toTuples(isolated.computeRubyRanges(c.text, dictOf(c))), c.id).toEqual(c.expected);
    }
  });
});
