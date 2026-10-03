import { describe, expect, it } from 'vitest';
import { loadDictionary } from '../../src/dictionary';

describe('loadDictionary', () => {
  it('パックの JSON と配列を重ねて読み、同じ対象文字列は先の辞書を残す', () => {
    const pack = { version: 1, rubyDictionary: [{ text: '漢字', reading: 'かんじ', enabled: true }, { text: '中', reading: 'なか' }] };
    const user = [{ text: '漢字', reading: 'カンジ' }, { text: '暫く', reading: 'しばら(く)' }];
    expect(loadDictionary([pack, user])).toEqual([
      { text: '漢字', reading: 'かんじ' },
      { text: '中', reading: 'なか' },
      { text: '暫く', reading: 'しばら(く)' },
    ]);
  });

  it('不正な語・無効な語・文字列でない語を落とし、priority は残す', () => {
    const src = [
      { text: '', reading: 'から' },
      { text: '書(く/け)', reading: 'か(き/け)' },
      { text: '止', reading: 'と', enabled: false },
      { text: 1, reading: 'x' },
      null,
      { text: '時', reading: 'とき', priority: 2 },
    ];
    expect(loadDictionary([src])).toEqual([{ text: '時', reading: 'とき', priority: 2 }]);
  });

  it('配列でもパックでもないものは無視する', () => {
    expect(loadDictionary([null, 'x', { foo: 1 }])).toEqual([]);
  });
});
