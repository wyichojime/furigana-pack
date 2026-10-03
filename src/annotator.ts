import { buildMatcher, matchRanges } from './core/matcher';
import type { DictEntry, RubyRange } from './core/types';

export interface Annotator {
  /** 振り仮名の位置と読み（UTF-16 の添字、start の昇順） */
  ranges(text: string): RubyRange[];
  /** <ruby>漢字<rt>かんじ</rt></ruby> の HTML（本文の HTML 特殊文字はエスケープ） */
  toHtml(text: string): string;
  /**
   * 青空文庫形式（｜漢字《かんじ》）。小説投稿サイトの多くも受け付ける。
   * 記法が壊れないよう、親文字・読みに ｜ | 《 》 改行を含む語と、本文で既に振り仮名の付いた箇所
   * （｜親文字《読み》・漢字《読み》）には付けない
   */
  toAozora(text: string): string;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

// 青空文庫形式の振り仮名の記法（｜親文字《読み》、漢字《読み》）
const AOZORA_RUBY = /[｜|][^｜|《》\r\n]*《[^《》\r\n]*》|《[^《》\r\n]*》/g;
// 親文字・読みに入ると記法が壊れる文字
const AOZORA_SPECIAL = /[｜|《》\r\n]/;

// 漢字（matcher.ts の RUBY-021 の判定と同じ。UTF-16 コード単位、U+20000–U+3FFFF は上位サロゲートで判定）
const isKanjiCode = (c: number) =>
  (c >= 0x4e00 && c <= 0x9fff) ||
  (c >= 0x3400 && c <= 0x4dbf) ||
  (c >= 0xf900 && c <= 0xfaff) ||
  (c >= 0x3005 && c <= 0x3007) ||
  c === 0x30f6 ||
  (c >= 0xd840 && c <= 0xd8bf);

/** 本文で既に振り仮名の付いた箇所（｜親文字《読み》の全体、漢字《読み》は直前に続く漢字と《読み》）の印。無ければ null */
function aozoraRubyMask(text: string): Uint8Array | null {
  let mask: Uint8Array | null = null;
  AOZORA_RUBY.lastIndex = 0;
  for (let m = AOZORA_RUBY.exec(text); m; m = AOZORA_RUBY.exec(text)) {
    let start = m.index;
    if (m[0][0] === '《') {
      while (start > 0) {
        const c = text.charCodeAt(start - 1);
        if (c >= 0xdc00 && c <= 0xdfff && start >= 2 && isKanjiCode(text.charCodeAt(start - 2))) start -= 2;
        else if (isKanjiCode(c)) start -= 1;
        else break;
      }
    }
    (mask ??= new Uint8Array(text.length)).fill(1, start, m.index + m[0].length);
  }
  return mask;
}

function render(
  text: string,
  ranges: readonly RubyRange[],
  plain: (s: string) => string,
  ruby: (base: string, reading: string) => string,
  skip?: (r: RubyRange) => boolean,
) {
  let out = '';
  let pos = 0;
  for (const r of ranges) {
    if (r.start < pos || (skip && skip(r))) continue;
    out += plain(text.slice(pos, r.start)) + ruby(text.slice(r.start, r.end), r.reading);
    pos = r.end;
  }
  return out + plain(text.slice(pos));
}

/** 渡した振り仮名の位置（start の昇順）で <ruby> の HTML を作る。本文の HTML 特殊文字はエスケープ。前と重なる位置は飛ばす */
export function rangesToHtml(text: string, ranges: readonly RubyRange[]): string {
  return render(text, ranges, escapeHtml, (base, reading) => `<ruby>${escapeHtml(base)}<rt>${escapeHtml(reading)}</rt></ruby>`);
}

/**
 * 渡した振り仮名の位置（start の昇順）で青空文庫形式（｜漢字《かんじ》）を作る。
 * toAozora と同じく、親文字・読みに ｜ | 《 》 改行を含む語と、本文で既に振り仮名の付いた箇所には付けない
 */
export function rangesToAozora(text: string, ranges: readonly RubyRange[]): string {
  const mask = aozoraRubyMask(text);
  return render(
    text,
    ranges,
    (s) => s,
    (base, reading) => `｜${base}《${reading}》`,
    (r) =>
      AOZORA_SPECIAL.test(r.reading) ||
      AOZORA_SPECIAL.test(text.slice(r.start, r.end)) ||
      (mask !== null && mask.subarray(r.start, r.end).includes(1)),
  );
}

/** 辞書を 1 回だけ準備し、本文に振り仮名を付ける関数をまとめて返す */
export function createAnnotator(dict: DictEntry[]): Annotator {
  const matcher = buildMatcher(dict);
  const ranges = (text: string) => matchRanges(matcher, text);
  return {
    ranges,
    toHtml: (text) => rangesToHtml(text, ranges(text)),
    toAozora: (text) => rangesToAozora(text, ranges(text)),
  };
}
