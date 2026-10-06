import { describe, expect, it } from 'vitest';
import { buildMatcher, matchRanges, matcherFromCompiled } from '../../src/core/index';
import type { DictEntry } from '../../src/core/types';
import { readJsonl, toTuples, type RangeCase } from './conformance-helpers';

type CompiledCase = { id: string; compiled: string[]; text: string; expected: [number, number, string][] };

describe('compiled-cases.jsonl（C# 版などの一致テスト用）', () => {
  const cases = readJsonl<CompiledCase>('compiled-cases.jsonl');
  const originals = [...readJsonl<RangeCase>('unit.jsonl'), ...readJsonl<RangeCase>('random.jsonl')];

  it('unit・random の全ケースを同じ順・同じ id・本文・期待値で持つ', () => {
    expect(cases.map((c) => [c.id, c.text, c.expected])).toEqual(originals.map((c) => [c.id, c.text, c.expected]));
  });

  it('解釈済みの形は、元の辞書を buildMatcher で準備したものと同じ（最新である）', () => {
    for (let i = 0; i < cases.length; i++) {
      const head = JSON.parse(cases[i].compiled[0]);
      expect(head.format, cases[i].id).toBe('furigana-pack-compiled');
      expect(head.groupCount, cases[i].id).toBe(cases[i].compiled.length - 1);
      expect(matcherFromCompiled(cases[i].compiled), cases[i].id).toEqual(buildMatcher((originals[i].dict ?? []) as DictEntry[]));
    }
  });

  it('解釈済みの形から照合した結果が期待値と同じ', () => {
    for (const c of cases) {
      expect(toTuples(matchRanges(matcherFromCompiled(c.compiled), c.text)), c.id).toEqual(c.expected);
    }
  });
});

describe('compiled-render-cases.jsonl（C# 版などの toAozora・toHtml の一致テスト用）', () => {
  it('render-cases.jsonl の全ケースを同じ順で持ち、解釈済みの形が最新である', () => {
    const cases = readJsonl<{ id: string; compiled: string[]; text: string; aozora: string; html: string }>('compiled-render-cases.jsonl');
    const originals = readJsonl<{ id: string; dict: DictEntry[]; text: string; aozora: string; html: string }>('render-cases.jsonl');
    expect(cases.map((c) => [c.id, c.text, c.aozora, c.html])).toEqual(originals.map((c) => [c.id, c.text, c.aozora, c.html]));
    for (let i = 0; i < cases.length; i++) {
      expect(matcherFromCompiled(cases[i].compiled), cases[i].id).toEqual(buildMatcher(originals[i].dict));
    }
  });
});
