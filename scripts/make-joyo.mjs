// 常用漢字の一覧 demo/src/joyo-kanji.ts を、Unicode の Unihan（Unihan_OtherMappings.txt の kJoyoKanji）から作る。
// 使い方: node scripts/make-joyo.mjs <Unihan_OtherMappings.txt のパス>
// 値が年（2010）の行は常用漢字表の字。値が U+XXXX の行は、その字の別の符号（例: 𠮟 に対する 叱）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const src = process.argv[2];
if (!src) throw new Error('Unihan_OtherMappings.txt のパスを指定してください');
const lib = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cp = (u) => parseInt(u.slice(2), 16);
const main = [];
const alternates = [];
for (const line of fs.readFileSync(src, 'utf8').split(/\r?\n/)) {
  // # で始まる行は注釈なので飛ばす
  if (line.startsWith('#')) continue;
  const [code, field, value] = line.split('\t');
  if (field !== 'kJoyoKanji') continue;
  if (/^\d{4}$/.test(value)) main.push(cp(code));
  else if (/^U\+[0-9A-F]+$/.test(value)) alternates.push(cp(code));
  else throw new Error(`想定外の値: ${line}`);
}
main.sort((a, b) => a - b);
const mainSet = new Set(main);
const alt = [...new Set(alternates)].filter((c) => !mainSet.has(c)).sort((a, b) => a - b);
if (main.length !== 2136) throw new Error(`常用漢字が ${main.length} 字です（2,136 字のはず）`);
const str = (list) => list.map((c) => String.fromCodePoint(c)).join('');
// 出典の注記は /*! */（legal comment）にする。esbuild は // の注釈を消すが、legal comment は配信物に残す
const out = `// 生成物: node scripts/make-joyo.mjs <Unihan_OtherMappings.txt>（Unicode Unihan の kJoyoKanji）。手で直さない。
/*! 常用漢字の一覧の出典: Unicode Unihan（kJoyoKanji）。Unicode License V3（https://www.unicode.org/license.txt）。Copyright © 1991-2025 Unicode, Inc. */
// 常用漢字表（平成 22 年内閣告示第 2 号）の 2,136 字。告示は著作権法 13 条により著作権の対象外。
export const JOYO_KANJI =
  ${JSON.stringify(str(main))};

/** 常用漢字の別の符号（例: 𠮟 に対する 叱）。常用漢字と同じ扱いにする */
export const JOYO_KANJI_ALTERNATES = ${JSON.stringify(str(alt))};
`;
fs.mkdirSync(path.join(lib, 'demo', 'src'), { recursive: true });
fs.writeFileSync(path.join(lib, 'demo', 'src', 'joyo-kanji.ts'), out);
console.log(`demo/src/joyo-kanji.ts: 常用漢字 ${main.length} 字、別の符号 ${alt.length} 字`);
