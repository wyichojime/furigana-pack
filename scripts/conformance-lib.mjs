// 一致テストのデータの生成と比較で共有する部品。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/** 決まった種から同じ並びを出す乱数（0 以上 1 未満） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KANJI = ['中', '時', '者', '値', '日', '行', '上', '下', '人', '本', '大', '小', '出', '入', '見', '来', '気', '分', '生', '後', '𠮷', '々'];
const HIRA = ['あ', 'い', 'う', 'か', 'が', 'の', 'を', 'に', 'は', 'た', 'る', 'し', 'て', 'だ', 'で', 'す', 'さ', 'ね'];
const KATA = ['メ', 'ン', 'テ', 'ナ', 'ス', 'カ', 'ー'];
const ALNUM = ['A', 'S', 'N', '3', '1', 'Ａ', '３', '２'];
const OTHER = ['。', '、', '　', ' ', '「', '」', '\n', '(', '/', '＋', '+'];
const READ = ['か', 'き', 'く', 'な', 'ま', 'し', 'ち', 'じ', 'ゅ', 'う', 'と', 'ひ'];
const BEFORE = ['漢字', 'ひらがな', 'カタカナ', '英数字'];

const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const repeat = (rand, arr, min, max) => {
  const n = min + Math.floor(rand() * (max - min + 1));
  let s = '';
  for (let i = 0; i < n; i++) s += pick(rand, arr);
  return s;
};
const twoDistinct = (rand, arr) => {
  const a = pick(rand, arr);
  let b = pick(rand, arr);
  while (b === a) b = pick(rand, arr);
  return [a, b];
};

/** 記法を 1 つ選んで辞書の 1 語と、その語が本文で一致する表記（surface）を作る */
function makeEntry(rand) {
  const kind = Math.floor(rand() * 9);
  const k = repeat(rand, KANJI, 1, 3);
  const rd = repeat(rand, READ, 1, 4);
  let entry;
  let surfaces;
  switch (kind) {
    case 0: // 条件なし
      entry = { text: k, reading: rd };
      surfaces = [k];
      break;
    case 1: { // 送り仮名（RUBY-007）
      const okuri = repeat(rand, HIRA, 1, 2);
      entry = { text: k + okuri, reading: `${rd}(${okuri})` };
      surfaces = [k + okuri];
      break;
    }
    case 2: { // 末尾のまとめ書き（RUBY-008）
      const [a1, a2] = twoDistinct(rand, HIRA);
      entry = { text: `${k}(${a1}/${a2})`, reading: `${rd}(${a1}/${a2})` };
      surfaces = [k + a1, k + a2];
      break;
    }
    case 3: { // 途中の仮名（RUBY-010）
      const k2 = pick(rand, KANJI);
      const h = pick(rand, HIRA);
      const rd2 = repeat(rand, READ, 1, 2);
      entry = { text: k + h + k2, reading: `${rd}(${h})${rd2}` };
      surfaces = [k + h + k2];
      break;
    }
    case 4: { // 先頭のまとめ書き（RUBY-026）
      const [n1, n2] = twoDistinct(rand, ['1', '2', '3', '21', '22']);
      entry = { text: `(${n1}/${n2})${k}`, reading: `(${n1}/${n2})${rd}` };
      surfaces = [n1 + k, n2 + k];
      break;
    }
    case 5: // +助詞（RUBY-023）
      entry = { text: `${k}${rand() < 0.5 ? '+' : '＋'}助詞`, reading: rd };
      surfaces = [k];
      break;
    case 6: { // +直前○○（RUBY-027）
      const one = pick(rand, KANJI);
      entry = { text: `${one}+直前${pick(rand, BEFORE)}`, reading: rd };
      surfaces = [one];
      break;
    }
    case 7: // 読みの括弧が本文と合わない登録（記法として解釈されず、読み全体がそのまま付く）
      entry = { text: `${k}る`, reading: `${rd}(た)` };
      surfaces = [`${k}る`];
      break;
    default: // 全角の英数字を含む語（RUBY-025）
      entry = { text: `${pick(rand, ALNUM)}${k}`, reading: rd };
      surfaces = [entry.text];
      break;
  }
  if (rand() < 0.1) entry.priority = 1;
  if (rand() < 0.05) entry.enabled = false;
  return { entry, surfaces };
}

/** 乱数のケースを 1 件作る（期待値は呼び出し側で参照実装から求める） */
export function makeRandomCase(rand, id) {
  const n = 1 + Math.floor(rand() * 12);
  const made = Array.from({ length: n }, () => makeEntry(rand));
  const pools = [KANJI, HIRA, KATA, ALNUM, OTHER];
  const tokens = 5 + Math.floor(rand() * 36);
  let text = '';
  for (let i = 0; i < tokens; i++) {
    if (rand() < 0.5) {
      const m = pick(rand, made);
      text += pick(rand, m.surfaces);
    } else {
      text += pick(rand, pick(rand, pools));
    }
  }
  return { id, dict: made.map((m) => m.entry), text };
}

/** 青空文庫のテキストから記法・前書き・後書きを取り除く */
export function stripAozora(text) {
  let s = text.replace(/\r\n/g, '\n');
  const parts = s.split(/\n-{20,}\n/);
  if (parts.length >= 3) s = parts.slice(2).join('\n');
  const tail = s.indexOf('\n底本：');
  if (tail >= 0) s = s.slice(0, tail);
  return s.replace(/《[^》]*》/g, '').replace(/｜/g, '').replace(/［＃[^］]*］/g, '').trim() + '\n';
}

/** 本文を約 5,000 字ごと（行の切れ目）に分ける。ずれが出たときに場所を絞りやすくするため */
export function chunkText(text, size = 5000) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const chunks = [];
  let cur = '';
  for (const line of lines) {
    cur += line + '\n';
    if (cur.length >= size) {
      chunks.push(cur);
      cur = '';
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

/** corpus/ 以下の .txt（UTF-8）を名前順に読む */
export function readCorpus(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.txt')) out.push({ name: path.relative(dir, p).split(path.sep).join('/'), text: fs.readFileSync(p, 'utf8') });
    }
  };
  walk(dir);
  return out;
}

export const toTuples = (ranges) => ranges.map((r) => [r.start, r.end, r.reading]);

/**
 * パックに依存する期待値（corpus.jsonl の行と variants-packs.json の中身）を作る。
 * make-conformance.mjs（参照実装）と make-pack-conformance.mjs（このライブラリ）で共有し、id と形式をそろえる。
 * @param {string} lib リポジトリの根
 * @param {{ prepare: (dict: object[]) => (text: string) => {start:number,end:number,reading:string}[], resolve: (text: string, reading: string) => unknown }} impl
 *   prepare は辞書を受け取り、本文から範囲を返す関数を返す。resolve は記法の解釈。
 */
export function makePackExpectations(lib, impl) {
  const confDir = path.join(lib, 'tests', 'conformance');
  const corpus = [];
  const variantsPacks = {};
  for (const pack of ['ruby-pack.json']) {
    // パックは Scenario Snip に読み込んだときと同じく rubyDictionary をそのまま辞書にする
    const dict = JSON.parse(fs.readFileSync(path.join(lib, 'data', pack), 'utf8')).rubyDictionary;
    // 記録で上限をかけた variants を補うため、パック全語の解釈結果を要約（件数と SHA-256）で確かめる
    const resolved = dict.map((e) => impl.resolve(e.text, e.reading) ?? null);
    variantsPacks[pack] = { count: dict.length, sha256: crypto.createHash('sha256').update(JSON.stringify(resolved)).digest('hex') };
    const ranges = impl.prepare(dict);
    for (const { name, text } of readCorpus(path.join(confDir, 'corpus'))) {
      chunkText(text).forEach((chunk, i) => {
        corpus.push({ id: `corpus-${pack.replace('.json', '')}-${name}-${i + 1}`, dictRef: pack, text: chunk, expected: toTuples(ranges(chunk)) });
      });
    }
  }
  return { corpus, variantsPacks };
}

/** tests/conformance/ へ JSONL（1 行 1 件、末尾に改行）を書く */
export function writeJsonl(confDir, file, rows) {
  fs.writeFileSync(path.join(confDir, file), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${file}: ${rows.length} 件`);
}

/** パックに依存する期待値の 2 ファイルを書く */
export function writePackExpectations(confDir, { corpus, variantsPacks }) {
  writeJsonl(confDir, 'corpus.jsonl', corpus);
  fs.writeFileSync(path.join(confDir, 'variants-packs.json'), JSON.stringify(variantsPacks, null, 2) + '\n');
  console.log('variants-packs.json:', JSON.stringify(variantsPacks));
}
