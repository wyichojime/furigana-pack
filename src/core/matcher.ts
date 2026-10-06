// 振り仮名の照合（純粋関数）。RUBY-015・021・022・023・025・027。
// 書き出し HTML に toString で埋め込まれるため、関数の外の変数・import・ほかの関数を使わない
// （notation.ts の resolveVariants と、このファイルの関数どうしの呼び出しだけは可）。
import { resolveVariants } from './notation';
import type { DictEntry, MatchForm, MatchGroup, Matcher, RubyRange, Segment } from './types';

/**
 * 辞書を照合単位へ準備する（RUBY-015 の照合順に並べる）。
 * 同じ照合形・同じ priority の形は 1 つの照合単位にまとめ、単位内で最も早い登録順の位置で照合する。
 * 照合形は全角半角を畳んだ後のもの（RUBY-025）。不正な登録・enabled: false の語は含めない。
 */
export function buildMatcher(dict: DictEntry[]): Matcher {
  const foldWidth = (s: string) =>
    s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
  const groups: MatchGroup[] = [];
  if (!Array.isArray(dict)) return { groups };
  const groupByKey = new Map<string, MatchGroup>();
  let formCount = 0;
  for (const e of dict) {
    if (
      !e ||
      e.enabled === false ||
      typeof e.text !== 'string' ||
      e.text.length === 0 ||
      typeof e.reading !== 'string' ||
      e.reading.length === 0
    ) {
      continue;
    }
    const resolved = resolveVariants(e.text, e.reading);
    if (!resolved) continue; // 送り仮名の記法が対象文字列・読みで一致しない不正登録は無視
    const priority = (e.priority ?? 0) | 0;
    for (const v of resolved) {
      const matchText = foldWidth(v.matchText);
      const key = priority + '\u0000' + matchText;
      let group = groupByKey.get(key);
      if (!group) {
        group = { matchText, priority, order: formCount, forms: [] };
        groupByKey.set(key, group);
        groups.push(group);
      }
      const form: MatchForm = {
        segments: v.segments,
        particle: !!v.particle,
        standalone: !!v.standalone,
        leftStandalone: !!v.leftStandalone,
        before: v.before || '',
      };
      group.forms.push(form);
      formCount += 1;
    }
  }
  groups.sort(
    (a, b) => b.matchText.length - a.matchText.length || b.priority - a.priority || a.order - b.order,
  );
  return { groups, byChar: indexMatcherGroups(groups) };
}

/**
 * 照合の索引を作る: 照合単位ごとに、照合形の中で（辞書全体で）最も出現の少ない文字を 1 つ選び、
 * 文字（UTF-16 コード単位）→ その文字を選んだ照合単位の番号（照合の順＝昇順）を引けるようにする。
 * 短い本文では、本文に現れる文字の箇所だけを照合候補にできる（選んだ文字が本文に無い照合単位は、
 * 索引を使わなくても必ず一致しないため、結果は変わらない）。照合形が空の照合単位は入れない。
 */
export function indexMatcherGroups(groups: MatchGroup[]): Map<number, Int32Array> {
  const freq = new Int32Array(65536);
  for (const g of groups) {
    const m = g.matchText;
    for (let i = 0; i < m.length; i++) freq[m.charCodeAt(i)] += 1;
  }
  const pick = new Int32Array(groups.length);
  const sizes = new Int32Array(65536);
  for (let gi = 0; gi < groups.length; gi++) {
    const m = groups[gi].matchText;
    let best = -1;
    for (let i = 0; i < m.length; i++) {
      const c = m.charCodeAt(i);
      if (best < 0 || freq[c] < freq[best]) best = c;
    }
    pick[gi] = best;
    if (best >= 0) sizes[best] += 1;
  }
  const byChar = new Map<number, Int32Array>();
  const lists: (Int32Array | null)[] = new Array(65536).fill(null);
  for (let c = 0; c < 65536; c++) {
    if (sizes[c] > 0) {
      const list = new Int32Array(sizes[c]);
      lists[c] = list;
      byChar.set(c, list);
      sizes[c] = 0; // ここからは書き込み位置として使う
    }
  }
  for (let gi = 0; gi < groups.length; gi++) {
    const c = pick[gi];
    if (c < 0) continue;
    (lists[c] as Int32Array)[sizes[c]++] = gi;
  }
  return byChar;
}

/**
 * 準備した照合器で本文に振り仮名を付ける（buildMatcher の結果は変えない。何度でも使える）。
 * 結果は start の昇順。照合の決まりは computeRubyRanges と同じ（RUBY-015・021・022・023・025・027）。
 */
export function matchRanges(matcher: Matcher, text: string): RubyRange[] {
  if (!text || !matcher || !Array.isArray(matcher.groups) || matcher.groups.length === 0) return [];
  const foldWidth = (s: string) =>
    s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, ' ');
  text = foldWidth(text);
  const groups = matcher.groups;
  // RUBY-021: 漢字（UTF-16 コード単位で判定。U+20000–U+3FFFF は上位サロゲートで判定）
  const isKanjiCode = (c: number) =>
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0xf900 && c <= 0xfaff) ||
    (c >= 0x3005 && c <= 0x3007) ||
    c === 0x30f6 ||
    (c >= 0xd840 && c <= 0xd8bf);
  const kanjiBefore = (idx: number) => {
    if (idx <= 0) return false;
    const c = text.charCodeAt(idx - 1);
    if (c >= 0xdc00 && c <= 0xdfff && idx >= 2) return isKanjiCode(text.charCodeAt(idx - 2));
    return isKanjiCode(c);
  };
  const kanjiAfter = (end: number) => end < text.length && isKanjiCode(text.charCodeAt(end));
  // RUBY-027: 直前の文字の種類（本文は全角英数字を半角へ置き換え済み）。どれでもなければ空文字。
  // 漢字は、ほかの登録語の範囲に入っている（占有済みの）ときだけ 'kanji' とする（登録語の後ろに付く 1 文字。
  // 未知の語・名前の途中の漢字では読みが定まらないため）。照合は長い照合形から順に進み、漢字 1 文字の語は
  // 直前・直後の漢字を占有できないため、この時点で直前の漢字の占有は確定している
  const kindBefore = (idx: number) => {
    if (idx <= 0) return '';
    if (kanjiBefore(idx)) return occupied[idx - 1] ? 'kanji' : '';
    const c = text.charCodeAt(idx - 1);
    if (c >= 0x3041 && c <= 0x3096) return 'hira';
    if ((c >= 0x30a1 && c <= 0x30fa) || c === 0x30fc) return 'kata';
    if ((c >= 0x30 && c <= 0x39) || (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a)) return 'alnum';
    return '';
  };
  // RUBY-023: 「+助詞」の語の直後に来てよい助詞（断定の だ・です・じゃ を含む）。
  // 終助詞の「さ」「ね」は、活用語尾（乱させる・善さ）や語の続き（一ねむり）と区別できず誤読が多いため含めない
  const particles = [
    'が', 'の', 'を', 'に', 'へ', 'と', 'で', 'や', 'は', 'も', 'か', 'よ', 'な', 'ぞ',
    'から', 'まで', 'より', 'だけ', 'しか', 'ほど', 'など', 'くらい', 'ぐらい', 'ばかり', 'さえ',
    'でも', 'こそ', 'って', 'だ', 'です', 'じゃ',
  ];
  const particleAfter = (end: number) => particles.some((p) => text.startsWith(p, end));
  const sameSegments = (a: Segment[], b: Segment[]) =>
    a.length === b.length &&
    a.every((s, i) => s.offset === b[i].offset && s.length === b[i].length && s.reading === b[i].reading);
  // 高速化（辞書 1 万件規模 × 長文を想定）: 本文の文字（UTF-16 コード単位）ごとの
  // 出現位置の索引を 1 回だけ作り、各語は「語の中で本文での出現が最も少ない文字」の
  // 出現位置だけを照合候補にする（本文全体を indexOf で走査しない）。本文に現れない
  // 文字を含む語は候補が 0 件なので照合しない。候補の開始位置を昇順にたどり、
  // 一致したら一致の直後から再開するため、indexOf による走査と結果は完全に同じ。
  const textLength = text.length;
  const charStart = new Int32Array(65537);
  for (let i = 0; i < textLength; i++) charStart[text.charCodeAt(i) + 1] += 1;
  for (let c = 0; c < 65536; c++) charStart[c + 1] += charStart[c];
  const charPositions = new Int32Array(textLength);
  const fillCursor = charStart.slice(0, 65536);
  for (let i = 0; i < textLength; i++) charPositions[fillCursor[text.charCodeAt(i)]++] = i;
  // 登録語ごとの本文占有区間（重複判定専用、表示には使わない）。
  // 旧実装の「採用済み区間の線形探索」はヒット数の二乗で遅くなるため、
  // 1 文字 1 バイトの占有マップで判定する（判定結果は同一）。
  const occupied = new Uint8Array(textLength);
  const visual: RubyRange[] = [];
  // 高速化（短い本文）: 索引があり、本文に現れる文字から引いた照合候補が全体の 1/4 未満なら、
  // 候補だけを照合の順に並べてたどる（1 文で辞書約 20 万の照合単位を全部たどらないため）。
  // 候補に入らない照合単位は、索引の文字が本文に無く一致しないので、結果は全部たどる場合と同じ
  let visit: Int32Array | null = null;
  const byChar = matcher.byChar;
  if (byChar) {
    const lists: Int32Array[] = [];
    let total = 0;
    for (let i = 0; i < textLength; i++) {
      const c = text.charCodeAt(i);
      // その文字の最初の出現位置のときだけ数える（文字の種類ごとに 1 回）
      if (charPositions[charStart[c]] === i) {
        const list = byChar.get(c);
        if (list) {
          lists.push(list);
          total += list.length;
        }
      }
    }
    if (total * 4 < groups.length) {
      visit = new Int32Array(total);
      let at = 0;
      for (const list of lists) {
        visit.set(list, at);
        at += list.length;
      }
      visit.sort();
    }
  }
  const visitCount = visit ? visit.length : groups.length;
  for (let gi = 0; gi < visitCount; gi++) {
    const group = groups[visit ? visit[gi] : gi];
    const matchText = group.matchText;
    const forms = group.forms;
    const needsContext = forms.some((f) => f.particle || f.standalone || f.leftStandalone || f.before);
    const matchLength = matchText.length;
    if (matchLength === 0) continue;
    let anchor = 0;
    let anchorCount = Infinity;
    for (let i = 0; i < matchLength; i++) {
      const code = matchText.charCodeAt(i);
      const count = charStart[code + 1] - charStart[code];
      if (count < anchorCount) {
        anchor = i;
        anchorCount = count;
        if (count === 0) break;
      }
    }
    if (anchorCount === 0) continue;
    const anchorCode = matchText.charCodeAt(anchor);
    const candidateEnd = charStart[anchorCode + 1];
    let nextStart = 0;
    for (let j = charStart[anchorCode]; j < candidateEnd; j++) {
      const idx = charPositions[j] - anchor;
      if (idx < nextStart) continue;
      if (idx + matchLength > textLength) break;
      if (!text.startsWith(matchText, idx)) continue;
      const occupiedEnd = idx + matchLength;
      // この位置で条件（RUBY-021/023/027）を満たす形。1 つも無ければ一致しなかった扱い
      // （範囲を占有せず、探索の再開位置も進めない）
      let candidates = forms;
      if (needsContext) {
        // RUBY-021: 直前が漢字なら照合しない。v2.7 から、直前がカタカナ・英数字のときも照合しない
        // （「キャンプ中」「インポート時」「SAN値」のように、カタカナ・英数字の後ろの漢字 1 文字は接尾語の読みになることが多い。
        // 読みが決まる字は +直前カタカナ などの語（RUBY-027）で付ける）
        const leftKind = kindBefore(idx);
        const leftOk = !kanjiBefore(idx) && leftKind !== 'kata' && leftKind !== 'alnum';
        const standaloneOk = leftOk && !kanjiAfter(occupiedEnd);
        const particleOk = particleAfter(occupiedEnd);
        const kind = leftKind;
        const rightOk = !kanjiAfter(occupiedEnd);
        candidates = forms.filter(
          (f) =>
            (!f.standalone || standaloneOk) &&
            (!f.leftStandalone || leftOk) &&
            (!f.particle || particleOk) &&
            (!f.before || (f.before === kind && rightOk)),
        );
        if (candidates.length === 0) continue;
        // RUBY-023/027: 条件付きの形が満たされたら、条件なしの形より優先する
        if (candidates.some((f) => f.particle || f.before)) {
          candidates = candidates.filter((f) => f.particle || f.before);
        }
      }
      let overlaps = false;
      for (let i = idx; i < occupiedEnd; i++) {
        if (occupied[i]) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        occupied.fill(1, idx, occupiedEnd);
        // RUBY-022: 候補のルビ区間が食い違う（読みが割れる）ときはルビを付けない
        const segments = candidates[0].segments;
        if (candidates.every((f) => sameSegments(f.segments, segments))) {
          for (const seg of segments) {
            visual.push({
              start: idx + seg.offset,
              end: idx + seg.offset + seg.length,
              reading: seg.reading,
            });
          }
        }
      }
      nextStart = occupiedEnd;
    }
  }
  visual.sort((a, b) => a.start - b.start);
  return visual;
}

/** 本文全体に対する振り仮名を計算する（Scenario Snip の互換のため。毎回辞書を準備し直す） */
export function computeRubyRanges(text: string, dict: DictEntry[]): RubyRange[] {
  if (!text || !Array.isArray(dict) || dict.length === 0) return [];
  return matchRanges(buildMatcher(dict), text);
}

/**
 * 解釈済みの形（data/compiled/*.json。1 行目は見出し、2 行目以降が照合の順の照合単位）から照合器を作る。
 * C#・Python 版が同じデータを読むときの手本でもある。
 * 見出し（format・version・groupCount）と各行の型・ルビ区間の範囲を確かめ、合わなければ Error を投げる
 * （改ざん・破損したデータで本文の外を指す振り仮名を返さないため）。
 */
export function matcherFromCompiled(lines: string[]): Matcher {
  const fail = (message: string): never => {
    throw new Error('解釈済みの形が不正です: ' + message);
  };
  const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const isInt32 = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v >= -2147483648 && v <= 2147483647;
  const parse = (line: string, where: string): unknown => {
    try {
      return JSON.parse(line);
    } catch {
      return fail(where + 'が JSON として読めません');
    }
  };
  if (!Array.isArray(lines) || lines.length === 0) fail('空です');
  const head = parse(String(lines[0]).replace(/^\ufeff/, ''), '見出し');
  if (!isObject(head)) return fail('見出しが JSON のオブジェクトではありません');
  if (head.format !== 'furigana-pack-compiled') fail('format が furigana-pack-compiled ではありません');
  if (head.version !== 1) fail('対応していない版です（version 1 だけを読めます）');
  if (head.groupCount !== undefined && !isInt32(head.groupCount)) fail('見出しの groupCount が整数ではありません');
  const groups: MatchGroup[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = String(lines[i]).replace(/\r$/, '');
    if (!line) continue;
    const where = `${i + 1} 行目`;
    const g = parse(line, where);
    if (!isObject(g)) return fail(where + 'が JSON のオブジェクトではありません');
    const { matchText, priority, order, forms } = g;
    if (typeof matchText !== 'string') return fail(where + 'の matchText が文字列ではありません');
    if (!isInt32(priority) || !isInt32(order)) return fail(where + 'の priority・order が整数ではありません');
    if (!Array.isArray(forms) || forms.length === 0) return fail(where + 'の forms が空か配列ではありません');
    groups.push({
      matchText,
      priority,
      order,
      forms: forms.map((f: unknown): MatchForm => {
        if (!isObject(f) || !Array.isArray(f.segments)) return fail(where + 'の形が壊れています');
        for (const key of ['particle', 'standalone', 'leftStandalone']) {
          if (f[key] !== undefined && typeof f[key] !== 'boolean') fail(where + `の ${key} が真偽値ではありません`);
        }
        if (f.before !== undefined && !['kanji', 'hira', 'kata', 'alnum'].includes(f.before as string)) {
          fail(where + 'の before が kanji・hira・kata・alnum のどれでもありません');
        }
        return {
          segments: f.segments.map((s: unknown): Segment => {
            if (!Array.isArray(s) || s.length !== 3) return fail(where + 'のルビ区間が [offset, length, reading] ではありません');
            const [offset, length, reading] = s as unknown[];
            if (!isInt32(offset) || !isInt32(length) || offset < 0 || length < 1 || offset + length > matchText.length) {
              return fail(where + 'のルビ区間が照合形の外を指しています');
            }
            if (typeof reading !== 'string' || !reading) return fail(where + 'のルビ区間の読みが空か文字列ではありません');
            return { offset, length, reading };
          }),
          particle: !!f.particle,
          standalone: !!f.standalone,
          leftStandalone: !!f.leftStandalone,
          before: (f.before || '') as MatchForm['before'],
        };
      }),
    });
  }
  if (head.groupCount !== undefined && head.groupCount !== groups.length) {
    fail(`途中で切れています（見出しは ${head.groupCount} 件、読めたのは ${groups.length} 件）`);
  }
  return { groups, byChar: indexMatcherGroups(groups) };
}
