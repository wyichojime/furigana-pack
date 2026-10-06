import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { dictOf, readJsonl, toTuples, type RangeCase } from './conformance-helpers';

const dist = path.resolve(__dirname, '..', '..', 'dist');
const cases = readJsonl<RangeCase>('random.jsonl').slice(0, 300);

describe('配布の形（npm run build の後）', () => {
  it('ES modules 版の createAnnotator が期待値と同じ', async () => {
    const mod = await import(pathToFileURL(path.join(dist, 'furigana-pack.mjs')).href);
    for (const c of cases) expect(toTuples(mod.createAnnotator(dictOf(c)).ranges(c.text)), c.id).toEqual(c.expected);
  });

  it('<script> 版はグローバル FuriganaPack を作り、import()/require() を含まない', () => {
    const code = fs.readFileSync(path.join(dist, 'furigana-pack.global.js'), 'utf8');
    expect(/\bimport\s*\(|\brequire\s*\(/.test(code)).toBe(false);
    const sandbox: Record<string, unknown> = {};
    vm.runInNewContext(code, sandbox);
    const lib = sandbox.FuriganaPack as { createAnnotator: (d: unknown) => { ranges: (t: string) => { start: number; end: number; reading: string }[] } };
    for (const c of cases) expect(toTuples(lib.createAnnotator(dictOf(c)).ranges(c.text)), c.id).toEqual(c.expected);
  });
});
