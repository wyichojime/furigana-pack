import { describe, expect, it } from 'vitest';
import { JOYO_KANJI, JOYO_KANJI_ALTERNATES } from '../../demo/src/joyo-kanji';
import { countKanji, filterDifficult, isCountedKanji, isDifficult } from '../../demo/src/difficult';

describe('常用漢字の一覧', () => {
  const joyo = Array.from(JOYO_KANJI);

  it('2,136 字で、重複が無い', () => {
    expect(joyo.length).toBe(2136);
    expect(new Set(joyo).size).toBe(2136);
  });

  it('代表的な字の有無', () => {
    for (const c of ['亜', '鬱', '虎', '日', '本']) expect(joyo).toContain(c);
    for (const c of ['嘘', '噂', '珈', '琲']) expect(joyo).not.toContain(c);
  });

  it('別の符号の字は常用漢字の本体と重ならない', () => {
    for (const c of Array.from(JOYO_KANJI_ALTERNATES)) expect(joyo).not.toContain(c);
  });
});

describe('漢字の数え方', () => {
  it('々 〆 〇 ヶ は数えない', () => {
    for (const c of ['々', '〆', '〇', 'ヶ']) expect(isCountedKanji(c.codePointAt(0)!)).toBe(false);
    expect(countKanji('人々が〇〇ヶ所')).toBe(2);
  });

  it('拡張 A・互換漢字・補助面の漢字は数える', () => {
    expect(countKanji('㐂')).toBe(1); // U+3402（拡張 A）
    expect(countKanji('﨑')).toBe(1); // U+FA11（互換漢字）
    expect(countKanji('𠮷野家')).toBe(3); // U+20BB7（補助面）
  });

  it('かな・英数字・記号は数えない', () => {
    expect(countKanji('かなカナabc123、。')).toBe(0);
  });
});

describe('難読語の判定', () => {
  it('常用漢字だけの語は対象外', () => {
    expect(isDifficult('日本')).toBe(false);
    expect(isDifficult('憂鬱')).toBe(false);
  });

  it('常用でない字を含む語は対象（送り仮名・かなは影響しない）', () => {
    expect(isDifficult('珈琲')).toBe(true);
    expect(isDifficult('馥郁たる')).toBe(true);
    expect(isDifficult('嘘つき')).toBe(true);
  });

  it('補助面の漢字は常用でない字として扱う', () => {
    expect(isDifficult('𠮷')).toBe(true);
  });

  it('々 〇 だけでは対象にならない', () => {
    expect(isDifficult('人々')).toBe(false);
    expect(isDifficult('〇')).toBe(false);
  });

  it('常用漢字の別の符号は常用と同じ扱い', () => {
    for (const c of Array.from(JOYO_KANJI_ALTERNATES)) expect(isDifficult(c), c).toBe(false);
  });

  it('filterDifficult は難読語の位置だけを順序を保って残す', () => {
    const text = '珈琲と日本と馥郁';
    const ranges = [
      { start: 0, end: 2, reading: 'こーひー' },
      { start: 3, end: 5, reading: 'にほん' },
      { start: 6, end: 8, reading: 'ふくいく' },
    ];
    expect(filterDifficult(text, ranges)).toEqual([ranges[0], ranges[2]]);
  });
});
