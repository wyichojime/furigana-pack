import { describe, expect, it, vi } from 'vitest';
import { createEngine, type PackName } from '../../demo/src/worker-core';

const packs: Record<PackName, unknown> = {
  'ruby-pack.json': { rubyDictionary: [{ text: '珈琲', reading: 'こーひー' }, { text: '日本', reading: 'にほん' }] },
};
const req = (over: Partial<{ text: string; difficultOnly: boolean }> = {}) => ({
  type: 'annotate' as const,
  id: 1,
  text: '今日は日本で珈琲',
  difficultOnly: false,
  ...over,
});

describe('createEngine', () => {
  it('メインのパックだけで照合し、HTML・青空文庫形式・漢字の数を返す', async () => {
    const engine = createEngine(async (name) => packs[name]);
    const r = await engine.annotate(req());
    expect(r).toEqual({
      type: 'result',
      id: 1,
      html: '今日は<ruby>日本<rt>にほん</rt></ruby>で<ruby>珈琲<rt>こーひー</rt></ruby>',
      aozora: '今日は｜日本《にほん》で｜珈琲《こーひー》',
      kanjiCount: 6,
      rubyKanjiCount: 4,
    });
  });

  it('難読語だけにすると常用でない字を含む語だけに付く', async () => {
    const engine = createEngine(async (name) => packs[name]);
    const r = await engine.annotate(req({ difficultOnly: true }));
    expect(r.aozora).toBe('今日は日本で｜珈琲《こーひー》');
    expect(r.rubyKanjiCount).toBe(2);
  });

  it('パックは 1 回だけ読む', async () => {
    const fetchPack = vi.fn(async (name: PackName) => packs[name]);
    const engine = createEngine(fetchPack);
    expect(engine.isReady()).toBe(false);
    await engine.annotate(req());
    await engine.annotate(req());
    expect(fetchPack.mock.calls.map((c) => c[0])).toEqual(['ruby-pack.json']);
    expect(engine.isReady()).toBe(true);
  });

  it('読み込みに失敗したら例外にし、次の呼び出しでやり直す', async () => {
    let fail = true;
    const engine = createEngine(async (name) => {
      if (fail) throw new Error('通信エラー');
      return packs[name];
    });
    await expect(engine.annotate(req())).rejects.toThrow('通信エラー');
    fail = false;
    await expect(engine.annotate(req())).resolves.toMatchObject({ type: 'result' });
  });

  it('辞書の構築に失敗したら isReady は false のままで、次の呼び出しでやり直す', async () => {
    let bad = true;
    // loadDictionary は壊れたパックを読み飛ばすので、項目の読み取りで例外が出る辞書を渡して構築を失敗させる
    const broken = { rubyDictionary: [{ get text(): string { throw new Error('辞書が壊れている'); }, reading: 'x' }] };
    const engine = createEngine(async (name) => (bad ? broken : packs[name]));
    await expect(engine.annotate(req())).rejects.toThrow('辞書が壊れている');
    expect(engine.isReady()).toBe(false);
    bad = false;
    await expect(engine.annotate(req())).resolves.toMatchObject({ type: 'result' });
    expect(engine.isReady()).toBe(true);
  });
});
