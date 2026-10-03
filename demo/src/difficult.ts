// 難読語の判定（デモと、後で作るブラウザ拡張機能で使う）。
// 難読語 = 常用漢字表に無い漢字を 1 字以上含む語。常用漢字だけで書ける熟字訓などは対象外。
import type { RubyRange } from '../../src/core/types';
import { JOYO_KANJI, JOYO_KANJI_ALTERNATES } from './joyo-kanji';

const JOYO = new Set<string>([...Array.from(JOYO_KANJI), ...Array.from(JOYO_KANJI_ALTERNATES)]);

/** 数える漢字か（コードポイント）。照合では漢字扱いの 々〆〇ヶ は数えない */
export function isCountedKanji(cp: number): boolean {
  return (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0x20000 && cp <= 0x3ffff)
  );
}

export function countKanji(s: string): number {
  let n = 0;
  for (const ch of s) if (isCountedKanji(ch.codePointAt(0)!)) n++;
  return n;
}

/** 常用でない漢字を 1 字以上含むか */
export function isDifficult(s: string): boolean {
  for (const ch of s) if (isCountedKanji(ch.codePointAt(0)!) && !JOYO.has(ch)) return true;
  return false;
}

/** 難読語の位置だけを残す（順序は保つ） */
export function filterDifficult(text: string, ranges: readonly RubyRange[]): RubyRange[] {
  return ranges.filter((r) => isDifficult(text.slice(r.start, r.end)));
}
