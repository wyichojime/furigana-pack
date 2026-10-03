import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMatcher, indexMatcherGroups, matchRanges } from '../../src/core/index';
import type { DictEntry, Matcher } from '../../src/core/types';
import { CONFORMANCE_DIR, dataDir } from './conformance-helpers';

const loadPack = (name: string) =>
  (JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8')) as { rubyDictionary: DictEntry[] }).rubyDictionary;

/** 一致テストの本文（自作の例文と青空文庫）を、句点と改行で 1 文ずつに分ける */
function corpusSentences(): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.txt')) {
        for (const s of fs.readFileSync(p, 'utf8').split(/(?<=。)|\n/)) if (s.trim()) out.push(s);
      }
    }
  };
  walk(path.join(CONFORMANCE_DIR, 'corpus'));
  return out;
}

describe('照合の索引（短い本文で、本文に無い文字を含む照合単位を飛ばす）', () => {
  const main = buildMatcher(loadPack('ruby-pack.json'));

  it('索引は照合単位を 1 つずつ、照合形に含まれる文字の箇所に、照合の順で持つ', () => {
    const seen = new Uint8Array(main.groups.length);
    for (const [code, list] of main.byChar ?? new Map<number, Int32Array>()) {
      for (let i = 0; i < list.length; i++) {
        const gi = list[i];
        if (i > 0) expect(gi).toBeGreaterThan(list[i - 1]);
        expect(seen[gi]).toBe(0);
        seen[gi] = 1;
        expect(main.groups[gi].matchText.indexOf(String.fromCharCode(code))).toBeGreaterThanOrEqual(0);
      }
    }
    expect(seen.every((v, gi) => v === 1 || main.groups[gi].matchText.length === 0)).toBe(true);
  });

  it('indexMatcherGroups は buildMatcher の索引と同じものを作る', () => {
    const dict = [
      { text: '中+直前カタカナ', reading: 'ちゅう' },
      { text: '(21/22)日', reading: '(21/22)にち' },
      { text: '慮る', reading: 'おもんぱか(る)' },
    ];
    const m = buildMatcher(dict);
    expect(indexMatcherGroups(m.groups)).toEqual(m.byChar);
  });

  it('本文の 1 文ずつで、索引を使った結果が索引なし（全部たどる）の結果と同じ', () => {
    // 全部たどる側が 1 文あたり約 10ms かかるため、本文全体から等間隔に約 2,000 文を取る
    const all = corpusSentences();
    expect(all.length).toBeGreaterThan(5000);
    const step = Math.ceil(all.length / 2000);
    const sentences = all.filter((_, i) => i % step === 0);
    const plain: Matcher = { groups: main.groups };
    for (const s of sentences) {
      expect(matchRanges(main, s), s).toEqual(matchRanges(plain, s));
    }
  }, 300_000);

  it('1 文の照合は平均 2ms 未満（メインのパック、約 20 万の照合単位）', () => {
    const s = 'その時、彼は箱の中を見た。';
    for (let i = 0; i < 20; i++) matchRanges(main, s);
    const t = performance.now();
    for (let i = 0; i < 100; i++) matchRanges(main, s);
    expect((performance.now() - t) / 100).toBeLessThan(2);
  });
});
