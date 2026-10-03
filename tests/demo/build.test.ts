import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..', '..');
const out = path.join(root, 'dist-demo');
const read = (p: string) => fs.readFileSync(path.join(out, p), 'utf8');
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

describe('demo:build', () => {
  beforeAll(() => {
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build-demo.mjs')], { cwd: root });
  }, 60_000);

  it('配信に要るファイルがそろい、解釈済みの形は置かない', () => {
    for (const f of ['index.html', 'licenses.html', 'demo.css', 'demo.js', 'worker.js', '_headers', 'data/ruby-pack.json', 'data/LICENSE.txt']) {
      expect(fs.existsSync(path.join(out, f)), f).toBe(true);
    }
    expect(fs.existsSync(path.join(out, 'data', 'compiled'))).toBe(false);
    expect(fs.existsSync(path.join(out, 'data', 'ruby-pack-common.json'))).toBe(false);
    // 拡張子の無い LICENSE はブラウザでダウンロードになるため置かない
    expect(fs.existsSync(path.join(out, 'data', 'LICENSE'))).toBe(false);
  });

  it('パックとライセンスは data/ と同じ中身', () => {
    expect(read('data/ruby-pack.json')).toBe(fs.readFileSync(path.join(root, 'data', 'ruby-pack.json'), 'utf8'));
    expect(read('data/LICENSE.txt')).toBe(fs.readFileSync(path.join(root, 'data', 'LICENSE'), 'utf8'));
  });

  it('_headers はキャッシュと CSP を明示し、index.html の meta と同じ CSP', () => {
    const headers = read('_headers');
    expect(headers).toContain('Cache-Control: public, max-age=0, must-revalidate');
    expect(headers).toContain(`Content-Security-Policy: ${CSP}`);
    expect(read('index.html')).toContain(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`);
  });

  it('画面にプライバシーの一文と、ライセンスのページへのリンク・更新日がある', () => {
    const html = read('index.html');
    expect(html).toContain('入力した本文はブラウザの中だけで処理し、どこにも送信しません。');
    expect(html).toContain('<a href="licenses.html">ライセンス</a>');
    expect(html).toMatch(/<span id="updated">\d{4}-\d{2}-\d{2}<\/span> 更新/);
    expect(html).not.toContain('%UPDATED%');
  });

  it('ライセンスのページにクレジットがあり、index.html と同じ CSP', () => {
    const html = read('licenses.html');
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${CSP}">`);
    // リンクのタグを除いた、見える文字で確かめる
    const text = html.replace(/<[^>]+>/g, '');
    expect(text).toContain('JMdict/JMnedict/KANJIDIC2');
    expect(text).toContain('© EDRDG');
    expect(text).toContain('Unicode Unihan');
    expect(text).toContain('Unicode License V3');
    expect(text).toContain('太宰治『走れメロス』（青空文庫）');
    expect(text).toContain('Copyright (c) 2026 wyichojime');
    expect(html).toContain('<a href="data/LICENSE.txt">利用条件</a>');
    expect(html).toContain('<a href="https://creativecommons.org/licenses/by-sa/4.0/deed.ja">CC BY-SA 4.0</a>');
    expect(html).toContain('<a href="https://www.edrdg.org/edrdg/licence.html">EDRDG</a>');
    expect(html).toContain('<a href="https://www.aozora.gr.jp/cards/000035/card1567.html">青空文庫</a>');
  });

  it('常用漢字の一覧の出典（Unicode License V3）が配信物の JS に残る', () => {
    expect(read('demo.js') + read('worker.js')).toContain('Unicode License V3');
  });

  it('パックのダウンロード欄は置かない（パックは worker.js が読むためだけに置く）', () => {
    const html = read('index.html');
    expect(html).not.toContain('download=');
    expect(html).not.toContain('%PACK_');
  });

  it('作者のホームページと GitHub へのリンクがある', () => {
    const html = read('index.html');
    expect(html).toContain('<a href="https://wyichojime.com/">');
    expect(html).toContain('<a href="https://github.com/wyichojime/furigana-pack">');
  });

  it('ステージングは検索に載せない', () => {
    expect(read('_headers')).toContain('X-Robots-Tag: noindex');
    expect(read('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
  });

  it('本番（--production）は検索に載せる', () => {
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build-demo.mjs'), '--production'], { cwd: root });
    expect(read('_headers')).not.toContain('X-Robots-Tag');
    expect(read('robots.txt')).toBe('User-agent: *\nAllow: /\n');
  });
});
