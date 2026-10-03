import { describe, expect, it } from 'vitest';
import { createAnnotator, rangesToAozora, rangesToHtml } from '../../src/annotator';
import { computeRubyRanges, type DictEntry } from '../../src/core/index';
import { dictOf, readJsonl, toTuples, type RangeCase } from './conformance-helpers';

type RenderCase = { id: string; dict: DictEntry[]; text: string; aozora: string; html: string };

const dict = [
  { text: '漢字', reading: 'かんじ' },
  { text: '慮る', reading: 'おもんぱか(る)' },
  { text: '中+直前カタカナ', reading: 'ちゅう' },
];

describe('createAnnotator', () => {
  const ruby = createAnnotator(dict);

  it('ranges は computeRubyRanges と同じ', () => {
    const text = '漢字を慮る。メンテナンス中。';
    expect(ruby.ranges(text)).toEqual(computeRubyRanges(text, dict));
  });

  it('toHtml は <ruby> を付け、本文の HTML 特殊文字をエスケープする', () => {
    expect(ruby.toHtml('<b>漢字</b>&"慮る\'')).toBe(
      '&lt;b&gt;<ruby>漢字<rt>かんじ</rt></ruby>&lt;/b&gt;&amp;&quot;<ruby>慮<rt>おもんぱか</rt></ruby>る&#39;',
    );
  });

  it('toAozora は ｜漢字《かんじ》 の形にする', () => {
    expect(ruby.toAozora('漢字を慮る。メンテナンス中。')).toBe('｜漢字《かんじ》を｜慮《おもんぱか》る。メンテナンス｜中《ちゅう》。');
  });

  it('振り仮名の無い本文はそのまま（toHtml はエスケープだけ）', () => {
    expect(ruby.toAozora('かな')).toBe('かな');
    expect(ruby.toHtml('a<b')).toBe('a&lt;b');
  });

  it('toAozora は記法を壊す読み・親文字の語と、本文で既に振り仮名の付いた箇所には付けない', () => {
    const r = createAnnotator([...dict, { text: '本文', reading: 'ほんぶん' }, { text: '偽', reading: 'にせ》｜x《y' }]);
    expect(r.toAozora('偽の｜本文《ほんぶん》と本文《てきすと》と漢字')).toBe('偽の｜本文《ほんぶん》と本文《てきすと》と｜漢字《かんじ》');
  });

  it('render-cases.jsonl の toAozora・toHtml が期待値と同じ', () => {
    const cases = readJsonl<RenderCase>('render-cases.jsonl');
    expect(cases.length).toBeGreaterThan(0);
    for (const c of cases) {
      const r = createAnnotator(c.dict);
      expect(r.toAozora(c.text), c.id).toBe(c.aozora);
      expect(r.toHtml(c.text), c.id).toBe(c.html);
    }
  });

  it('random.jsonl の先頭 200 件で ranges が期待値と同じ', () => {
    for (const c of readJsonl<RangeCase>('random.jsonl').slice(0, 200)) {
      expect(toTuples(createAnnotator(dictOf(c) as DictEntry[]).ranges(c.text)), c.id).toEqual(c.expected);
    }
  });
});

describe('rangesToHtml・rangesToAozora', () => {
  const ruby = createAnnotator(dict);
  const text = '漢字を慮る。メンテナンス中。';

  it('全部の位置を渡すと toHtml・toAozora と同じ', () => {
    expect(rangesToHtml(text, ruby.ranges(text))).toBe(ruby.toHtml(text));
    expect(rangesToAozora(text, ruby.ranges(text))).toBe(ruby.toAozora(text));
  });

  it('一部だけ渡すとその位置にだけ付く', () => {
    const only = ruby.ranges(text).filter((r) => text.slice(r.start, r.end) === '慮');
    expect(rangesToHtml(text, only)).toBe('漢字を<ruby>慮<rt>おもんぱか</rt></ruby>る。メンテナンス中。');
    expect(rangesToAozora(text, only)).toBe('漢字を｜慮《おもんぱか》る。メンテナンス中。');
  });

  it('rangesToAozora は渡された位置でも、既に振り仮名の付いた箇所と記法を壊す読みを飛ばす', () => {
    const t = '漢字《かんじ》と漢字';
    const all = [
      { start: 0, end: 2, reading: 'かんじ' },
      { start: 8, end: 10, reading: 'か《ん》じ' },
    ];
    expect(rangesToAozora(t, all)).toBe('漢字《かんじ》と漢字');
  });

  it('render-cases の全件で toHtml・toAozora と同じ', () => {
    for (const c of readJsonl<RenderCase>('render-cases.jsonl')) {
      const r = createAnnotator(c.dict);
      expect(rangesToHtml(c.text, r.ranges(c.text)), c.id).toBe(c.html);
      expect(rangesToAozora(c.text, r.ranges(c.text)), c.id).toBe(c.aozora);
    }
  });
});
