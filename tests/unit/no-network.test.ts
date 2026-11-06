import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// README・SECURITY.md の約束「ライブラリは外部と通信しない」を、3 つの実装のソースで確かめる。
// 試用ページ（demo/）はパックを同じオリジンから読むため対象にしない（CSP は tests/demo/build.test.ts が見る）。
const root = path.resolve(__dirname, '..', '..');
// ビルドの出力（C# の bin/・obj/、Python の __pycache__/）は見ない
const sources = (dir: string, ext: string): string[] =>
  fs
    .readdirSync(path.join(root, dir), { withFileTypes: true, recursive: true })
    .filter((d) => d.isFile() && d.name.endsWith(ext))
    .map((d) => path.relative(root, path.join(d.parentPath, d.name)))
    .filter((f) => !/[\\/](bin|obj|__pycache__)[\\/]/.test(f));

const cases: [string, string, string, RegExp][] = [
  ['JavaScript', 'src', '.ts', /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|node:(https?|net|dgram|tls)\b|\bimport\s*\(|\brequire\s*\(/],
  ['Python', 'python/furigana_pack', '.py', /\b(urllib|http\.client|socket|requests|ssl)\b/],
  ['C#', 'csharp/FuriganaPack', '.cs', /\bSystem\.Net\b|HttpClient|WebClient|\bSocket\b/],
];

describe('ライブラリは外部と通信しない', () => {
  it.each(cases)('%s 版（%s/）に通信の API が無い', (_name, dir, ext, pattern) => {
    const files = sources(dir, ext);
    expect(files.length).toBeGreaterThan(0);
    const hits = files.filter((f) => pattern.test(fs.readFileSync(path.join(root, f), 'utf8')));
    expect(hits).toEqual([]);
  });
});
