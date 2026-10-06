// 振り仮名の記法の解釈（純粋関数）。RUBY-007・008・010・021・023・026・027。
// 書き出し HTML に toString で埋め込まれるため、関数の外の変数・import・ほかの関数を使わない
// （このファイルと matcher.ts の関数どうしの呼び出しだけは可。型の import は消えるので可）。
import type { BeforeKind, Segment, Variant } from './types';

/**
 * 読みに含まれる「(...)」（1 個以上、対象文字列中の実文字と一致する送り仮名・
 * 活用語尾などの「ルビ不要区間」）を解析し、対象文字列全体をルビ区間・プレーン区間へ
 * 分割する（表示専用・純粋関数）。
 * 例: text="窺い知", reading="うかが(い)し" の場合、"窺"→ルビ"うかが"、
 * "い"→プレーン（括弧内と一致する実文字のためルビ不要）、"知"→ルビ"し" に分割する。
 * 括弧の前後の読み区間が対象文字列中の対応区間に矛盾なく一致する場合のみ分割結果
 * （ルビ区間の配列）を返す。矛盾がある場合（括弧内の文字列が見つからない、読みが
 * 空なのに対象文字列側に文字が残っている、など）は null を返す（呼び出し側でフォール
 * バック）。
 * @returns {{offset:number, length:number, reading:string}[]|null}
 */
export function parseSegmentedReading(text: string, reading: string): Segment[] | null {
  if (reading.indexOf('(') === -1) return null;
  const tokens = reading.split(/\(([^()]*)\)/);
  if (tokens.length < 3 || (tokens.length - 1) % 2 !== 0) return null;
  for (let i = 1; i < tokens.length; i += 2) {
    if (!tokens[i]) return null; // 空の括弧は無効
  }
  const segments: Segment[] = [];
  let cursor = 0;
  for (let i = 0; i < tokens.length; i += 2) {
    const rubySeg = tokens[i];
    const isLast = i === tokens.length - 1;
    if (isLast) {
      const remaining = text.length - cursor;
      if (rubySeg === '') {
        if (remaining !== 0) return null;
      } else {
        if (remaining <= 0) return null;
        segments.push({ offset: cursor, length: remaining, reading: rubySeg });
      }
      cursor = text.length;
      break;
    }
    const literalSeg = tokens[i + 1];
    const idx = text.indexOf(literalSeg, cursor);
    if (idx < 0) return null;
    const chunkLen = idx - cursor;
    if (rubySeg === '') {
      if (chunkLen !== 0) return null;
    } else {
      if (chunkLen <= 0) return null;
      segments.push({ offset: cursor, length: chunkLen, reading: rubySeg });
    }
    cursor = idx + literalSeg.length;
  }
  if (cursor !== text.length) return null;
  return segments;
}

/**
 * 文字列末尾の「base(alt1/alt2/...)」形式を解析する（純粋関数）。
 * alt が 1 件のみの場合は対象外（従来の splitRubyReading の記法と区別するため）とし null を返す。
 * @returns {{base:string, alts:string[]}|null}
 */
export function parseParenAlternation(str: string) {
  const m = /^(.+?)\(([^()]+)\)\s*$/.exec(str);
  if (!m) return null;
  const base = m[1];
  const alts = m[2].split('/').map((s) => s.trim());
  if (!base || alts.length < 2 || alts.some((a) => !a)) return null;
  return { base, alts };
}

/**
 * 対象文字列・読みから、実際にマッチさせる語のバリエーションを解決する（純粋関数）。
 * 例1（複数送り仮名の一括登録）: text="微睡(み/む)", reading="まどろ(み/む)" の場合、
 * "微睡み" と "微睡む" のどちらにもマッチし、いずれも "微睡" 部分にのみ読み "まどろ" の
 * ルビを付与する（送り仮名は対象文字列・読みで一致している必要がある）。
 * 対象文字列側に複数の送り仮名（alt が 2 件以上）の記法があるのに、読み側の記法が
 * 存在しない・件数が違う・内容が一致しない場合は不正な登録として null を返す（弾く）。
 * 例2（部分ルビ・中間の送り仮名を含む）: 対象文字列側にこの記法がない場合は
 * parseSegmentedReading により、読み中の「(...)」区間（対象文字列中の実文字と一致する
 * 部分）を除いた区間ごとにルビを割り当てる。読みに括弧がない、または区間分割が
 * 対象文字列と整合しない場合は、対象文字列全体に読み全文でルビを付与する（フォールバック）。
 * 例3（RUBY-023）: 対象文字列の末尾の「+助詞」（全角「＋」も可）は照合形に含めず、
 * 各形に particle: true を付ける（照合形の直後が助詞のときだけ照合する）。
 * RUBY-021: 送り仮名の記法の無い漢字 1 文字の語は standalone: true を、漢字 1 文字＋送り仮名の語は
 * leftStandalone: true を付ける
 * （前後に漢字が続く位置では照合しない）。どちらの印も当てはまるときだけ付ける。
 * RUBY-027: 「+助詞」の手前の「+直前漢字」「+直前ひらがな」「+直前カタカナ」「+直前英数字」（全角「＋」も可）は
 * 照合形に含めず、before に種類を付ける（standalone の代わり。直前がその種類で直後が漢字でない位置だけ照合する）。
 * 手前が漢字 1 文字でない登録は不正（null）。
 * 出力 HTML へ toString で直列化されるため、ここで使うのは標準組み込みと
 * 同じく直列化される parseParenAlternation / parseSegmentedReading のみとする。
 * @returns {{matchText:string, segments:{offset:number,length:number,reading:string}[], particle?:true, standalone?:true, leftStandalone?:true, before?:string}[]|null}
 */
export function resolveVariants(text: string, reading: string): Variant[] | null {
  const particleMark = /[+＋]助詞$/.exec(text);
  if (particleMark) {
    text = text.slice(0, particleMark.index);
    if (!text) return null;
  }
  const singleKanji = /^(?:[々-〇ヶ㐀-䶿一-鿿豈-﫿]|[\ud840-\ud8bf][\udc00-\udfff])$/;
  // RUBY-027: 直前の文字の種類の条件（漢字 1 文字の語だけ）
  const beforeMark = /[+＋]直前(漢字|ひらがな|カタカナ|英数字)$/.exec(text);
  let before: BeforeKind | null = null;
  if (beforeMark) {
    text = text.slice(0, beforeMark.index);
    if (!singleKanji.test(text)) return null;
    before = ({ 漢字: 'kanji', ひらがな: 'hira', カタカナ: 'kata', 英数字: 'alnum' } as const)[
      beforeMark[1] as '漢字' | 'ひらがな' | 'カタカナ' | '英数字'
    ];
  }
  const flags = {
    ...(particleMark ? { particle: true as const } : {}),
    ...(before ? { before } : singleKanji.test(text) ? { standalone: true as const } : {}),
    // RUBY-021: 漢字 1 文字＋送り仮名の語（出す・煽(る/り) など）は直前だけを見る
    ...(/^(?:[々-〇ヶ㐀-䶿一-鿿豈-﫿]|[\ud840-\ud8bf][\udc00-\udfff])(?:[ぁ-ゖ]+|\([ぁ-ゖ/]+\))$/.test(text)
      ? { leftStandalone: true as const }
      : {}),
  };
  // RUBY-026: 先頭の「(alt1/alt2/...)残り」記法（例: (21/22/23)日 / (21/22/23)にち）。
  // 先頭だけが違い、残りの読みが共通の語をまとめる。括弧内は本文の文字をそのまま出す（ルビなし）。
  // 各 alt を「alt＋残り」「(alt)＋読みの残り」の 1 語に展開し、通常の記法として解決し直す。
  // 末尾の alt 記法との併用は不可（不正）。
  const headAlt = /^\(([^()]+)\)(.+)$/.exec(text);
  if (headAlt) {
    const alts = headAlt[1].split('/').map((s) => s.trim());
    if (alts.length >= 2 && alts.every((a) => a)) {
      const readingHead = /^\(([^()]+)\)(.+)$/.exec(reading);
      if (!readingHead) return null;
      const readingAlts = readingHead[1].split('/').map((s) => s.trim());
      if (readingAlts.join('/') !== alts.join('/')) return null;
      if (parseParenAlternation(headAlt[2])) return null;
      const out: Variant[] = [];
      for (const alt of alts) {
        const sub = resolveVariants(alt + headAlt[2], '(' + alt + ')' + readingHead[2]);
        if (!sub) return null;
        for (const v of sub) out.push(particleMark ? { ...v, particle: true as const } : v);
      }
      return out;
    }
  }
  const textAlt = parseParenAlternation(text);
  if (textAlt) {
    const readingAlt = parseParenAlternation(reading);
    if (!readingAlt) return null;
    if (readingAlt.alts.length !== textAlt.alts.length) return null;
    const mismatch = textAlt.alts.some((a, i) => a !== readingAlt.alts[i]);
    if (mismatch) return null;
    return textAlt.alts.map((alt) => ({
      matchText: textAlt.base + alt,
      segments: [
        { offset: 0, length: textAlt.base.length, reading: readingAlt.base },
      ],
      ...flags,
    }));
  }
  const segmented = parseSegmentedReading(text, reading);
  if (segmented) {
    return [{ matchText: text, segments: segmented, ...flags }];
  }
  return [
    { matchText: text, segments: [{ offset: 0, length: text.length, reading }], ...flags },
  ];
}
