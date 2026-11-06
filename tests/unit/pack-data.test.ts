import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dataDir } from './conformance-helpers';

// 振り仮名パック（data/ruby-pack.json）の形と、data/README.md の「収録の決まり」を確かめる。
// パックは Scenario Snip の「インポート」でも読まれるため、形が崩れると Scenario Snip 側で読めなくなる。
type Entry = { text: unknown; reading: unknown; enabled?: unknown };
const pack = JSON.parse(fs.readFileSync(path.join(dataDir, 'ruby-pack.json'), 'utf8')) as {
  version: unknown;
  pack: { id: unknown; name: unknown; version: unknown };
  rubyDictionary: Entry[];
};

describe('振り仮名パック（data/ruby-pack.json）の形', () => {
  it('見出しは version 1・パックの id と名前・日付の版を持つ', () => {
    expect(pack.version).toBe(1);
    expect(pack.pack.id).toBe('scenario-snip-ruby-pack');
    expect(pack.pack.name).toBe('振り仮名パック');
    expect(pack.pack.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(pack.rubyDictionary)).toBe(true);
  });

  it('どの語も、空でない text・reading の文字列だけを持つ（enabled は真偽値）', () => {
    const bad = pack.rubyDictionary.filter(
      (e) =>
        typeof e.text !== 'string' ||
        e.text === '' ||
        typeof e.reading !== 'string' ||
        e.reading === '' ||
        ('enabled' in e && typeof e.enabled !== 'boolean') ||
        Object.keys(e).some((k) => !['text', 'reading', 'enabled'].includes(k)),
    );
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('同じ文字列（text）に 2 つの読みを持たせない（同じ text の語が 2 回出てこない）', () => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const e of pack.rubyDictionary) {
      if (seen.has(e.text as string)) dup.push(e.text as string);
      seen.add(e.text as string);
    }
    expect(dup.slice(0, 5)).toEqual([]);
  });
});
