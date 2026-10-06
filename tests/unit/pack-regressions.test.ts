import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAnnotator } from '../../src/annotator';
import { loadDictionary } from '../../src/dictionary';

// パック（メインだけ）で見つかった読み誤りの回帰テスト。
// 規則の語「漢字+直前ひらがな」（点+直前ひらがな＝てん など）は直後がひらがなでも当たるため、
// 送り仮名の付く動詞の形をメインに入れておかないと、その動詞に規則の読みが付く。
// ただし短い形（点さ・曲っ・説か など）は「名詞＋助詞」（この点さえ・この曲って・この説か）にも当たるため、
// メインには名詞＋助詞と区別できる長さの形だけを入れる。
const main = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'data', 'ruby-pack.json'), 'utf8'));
const ruby = createAnnotator(loadDictionary([main]));

describe('メインのパックの読み誤りの回帰', () => {
  it.each([
    ['街灯が点り始める', '｜点《とも》り'],
    ['明かりが点る', '｜点《とも》る'],
    ['灯が点った', '｜点《とも》った'],
    ['道が曲った', '｜曲《まが》った'],
    ['熱が籠らない', '｜籠《こも》らない'],
    ['願いが敵う', '｜敵《かな》う'],
    ['機嫌を損う', '｜損《そこな》う'],
    ['道を説こう', '｜説《と》こう'],
  ])('%s', (text, expected) => {
    expect(ruby.toAozora(text)).toContain(expected);
  });

  it('規則の語は、送り仮名でない使い方では従来どおり付く', () => {
    expect(ruby.toAozora('その点、')).toContain('｜点《てん》');
  });

  // 名詞＋助詞（って・らしい・さえ・すら・せめて・か・こそ）に動詞の読みを付けない
  it.each([
    ['この曲って好き', '曲', 'きょく'],
    ['その曲らしい', '曲', 'きょく'],
    ['この点さえ', '点', 'てん'],
    ['この点すら', '点', 'てん'],
    ['この点せめて', '点', 'てん'],
    ['この点って大事', '点', 'てん'],
    ['この説か、あの説か', '説', 'せつ'],
    ['この説こそ', '説', 'せつ'],
    ['この籠らしい', '籠', 'かご'],
    ['熱って何度？', '熱', 'ねつ'],
  ])('%s', (text, kanji, reading) => {
    const out = ruby.toAozora(text);
    const readings = [...out.matchAll(new RegExp(`｜${kanji}《([^》]+)》`, 'g'))].map((m) => m[1]);
    // 振り仮名が付かないのは可。付くなら名詞の読みだけ
    for (const r of readings) expect(r).toBe(reading);
  });
});

// 世の読み誤り。
// 世(は/が/と/や など)＝せい は「ルイ14世は」のような代の数え方から入った語で、
// 「人の世は」「この世が」などにも当たり、規則の語（世+直前ひらがな＝よ）より先に付いていた。
// メインだけで、これらの文の世が よ になること。
describe('メインの世の読みの回帰', () => {
  it.each([
    ['とかくに人の世は住みにくい', '世', 'よ'],
    ['この世が終わる', '世', 'よ'],
    ['あの世とこの世', '世', 'よ'],
    ['この世や、あの世', '世', 'よ'],
    ['この世など', '世', 'よ'],
    ['この世のような', '世', 'よ'],
  ])('%s', (text, kanji, reading) => {
    const out = ruby.toAozora(text);
    const readings = [...out.matchAll(new RegExp(`｜${kanji}《([^》]+)》`, 'g'))].map((m) => m[1]);
    // 世に実際に振り仮名が付くこと（付かないまま通る空振りを防ぐ）
    expect(readings.length).toBeGreaterThan(0);
    for (const r of readings) expect(r).toBe(reading);
  });
});

// 単独の「市」＝し は「シラクスの市」「朝の市」のように町・市場の意味（いち・まち）にも当たるため外した。
// 地名の語（横浜市）や、カタカナ・数字の後ろの市（ニューヨーク市・3市）にはこれまでどおり し が付く。
describe('市の読み誤りの回帰', () => {
  it('ひらがなの後ろの単独の市には付けない', () => {
    expect(ruby.toAozora('シラクスの市にやって来た')).not.toContain('｜市《し》');
  });
  it.each([
    ['横浜市に住む', '｜横浜市《よこはまし》'],
    ['ニューヨーク市の人口', '｜市《し》'],
    ['3市が合併', '｜市《し》'],
  ])('%s', (text, expected) => {
    expect(ruby.toAozora(text)).toContain(expected);
  });
});
