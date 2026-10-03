import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMatcher, computeRubyRanges, matchRanges, resolveVariants } from '../../src/core/index';
import type { DictEntry } from '../../src/core/index';
import {
  CONFORMANCE_DIR,
  dictOf,
  loadPack,
  readJsonl,
  toTuples,
  type RangeCase,
  type VariantCase,
} from './conformance-helpers';

describe('記法の解釈（resolveVariants）', () => {
  it('参照実装の結果と一致する', () => {
    for (const c of readJsonl<VariantCase>('variants.jsonl')) {
      expect(resolveVariants(c.text, c.reading) ?? null, c.id).toEqual(c.expected);
    }
  });

  it('パック全語の結果の要約（語数と SHA-256）が参照実装と一致する', () => {
    const packs = JSON.parse(fs.readFileSync(path.join(CONFORMANCE_DIR, 'variants-packs.json'), 'utf8')) as Record<
      string,
      { count: number; sha256: string }
    >;
    for (const [name, recorded] of Object.entries(packs)) {
      const entries = loadPack(name) as DictEntry[];
      const json = JSON.stringify(entries.map((e) => resolveVariants(e.text, e.reading) ?? null));
      expect(entries.length, name).toBe(recorded.count);
      expect(crypto.createHash('sha256').update(json).digest('hex'), name).toBe(recorded.sha256);
    }
  });
});

describe('照合（computeRubyRanges）', () => {
  it.each(['unit.jsonl', 'random.jsonl'])('%s の全件が参照実装と一致する', (file) => {
    for (const c of readJsonl<RangeCase>(file)) {
      expect(toTuples(computeRubyRanges(c.text, dictOf(c) as DictEntry[])), c.id).toEqual(c.expected);
    }
  });
});

describe('照合を 2 段に分けても結果が変わらない（buildMatcher → matchRanges）', () => {
  it('unit・random の全件が一致し、準備した照合器を何度使っても同じ', () => {
    for (const file of ['unit.jsonl', 'random.jsonl']) {
      for (const c of readJsonl<RangeCase>(file)) {
        const m = buildMatcher(dictOf(c) as DictEntry[]);
        expect(toTuples(matchRanges(m, c.text)), c.id).toEqual(c.expected);
        expect(toTuples(matchRanges(m, c.text)), c.id).toEqual(c.expected);
      }
    }
  });

  it('パック全体を本文（青空文庫・自作の例文）に当てた結果が一致する', () => {
    const matchers = new Map<string, ReturnType<typeof buildMatcher>>();
    for (const c of readJsonl<RangeCase>('corpus.jsonl')) {
      const ref = c.dictRef as string;
      let m = matchers.get(ref);
      if (!m) {
        m = buildMatcher(loadPack(ref) as DictEntry[]);
        matchers.set(ref, m);
      }
      expect(toTuples(matchRanges(m, c.text)), c.id).toEqual(c.expected);
    }
  }, 120_000);

  it('辞書が空・不正でも落ちない', () => {
    expect(matchRanges(buildMatcher([]), 'あ')).toEqual([]);
    expect(matchRanges(buildMatcher(undefined as unknown as DictEntry[]), 'あ')).toEqual([]);
    expect(matchRanges(buildMatcher([{ text: '字', reading: 'じ' }]), '')).toEqual([]);
  });
});
