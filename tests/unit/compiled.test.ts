import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMatcher, matchRanges, matcherFromCompiled } from '../../src/core/index';
import { dataDir, readJsonl, toTuples, type RangeCase } from './conformance-helpers';

const HEAD = '{"format":"furigana-pack-compiled","version":1}';

const readLines = (name: string) =>
  fs.readFileSync(path.join(dataDir, 'compiled', name), 'utf8').split('\n').filter(Boolean);

describe('解釈済みの形（data/compiled）', () => {
  for (const pack of ['ruby-pack.json']) {
    it(`${pack}: 解釈済みの形から作った照合器が corpus.jsonl の期待値と同じ`, () => {
      const lines = readLines(pack);
      const head = JSON.parse(lines[0]);
      expect(head.format).toBe('furigana-pack-compiled');
      expect(head.groupCount).toBe(lines.length - 1);
      const m = matcherFromCompiled(lines);
      const cases = readJsonl<RangeCase>('corpus.jsonl').filter((c) => c.dictRef === pack);
      expect(cases.length).toBeGreaterThan(0);
      for (const c of cases) expect(toTuples(matchRanges(m, c.text)), c.id).toEqual(c.expected);
    }, 120_000);
  }

  it('matcherFromCompiled は buildMatcher と同じ照合単位を作る（小さな辞書）', () => {
    const dict = [
      { text: '中+直前カタカナ', reading: 'ちゅう' },
      { text: '(21/22)日', reading: '(21/22)にち' },
      { text: '慮る', reading: 'おもんぱか(る)', priority: 1 },
      { text: '為+助詞', reading: 'ため' },
    ];
    const built = buildMatcher(dict);
    const lines = [
      '{"format":"furigana-pack-compiled","version":1}',
      ...built.groups.map((g) =>
        JSON.stringify({
          matchText: g.matchText,
          priority: g.priority,
          order: g.order,
          forms: g.forms.map((f) => ({
            segments: f.segments.map((s) => [s.offset, s.length, s.reading]),
            ...(f.particle ? { particle: true } : {}),
            ...(f.standalone ? { standalone: true } : {}),
            ...(f.leftStandalone ? { leftStandalone: true } : {}),
            ...(f.before ? { before: f.before } : {}),
          })),
        }),
      ),
    ];
    expect(matcherFromCompiled(lines)).toEqual(built);
  });

  it('compiled-invalid.jsonl の壊れた・改ざんされた形はどれも読み込みで拒否する', () => {
    const cases = readJsonl<{ id: string; lines: string[] }>('compiled-invalid.jsonl');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) expect(() => matcherFromCompiled(c.lines), c.id).toThrow(/解釈済みの形が不正です/);
  });

  it('見出しの BOM・行末の CR・空行は許す', () => {
    const group = '{"matchText":"漢字","priority":0,"order":0,"forms":[{"segments":[[0,2,"かんじ"]]}]}';
    const m = matcherFromCompiled(['\ufeff' + HEAD.replace('}', ',"groupCount":1}'), group + '\r', '']);
    expect(toTuples(matchRanges(m, '漢字'))).toEqual([[0, 2, 'かんじ']]);
  });
});
