import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// README の約束（データは CC BY-SA 4.0・クレジットの表示例・依存パッケージなし）が、配布するファイルに残っていることを確かめる。
// 試用ページ（dist-demo/licenses.html）のクレジットは tests/demo/build.test.ts が見る。
const root = path.resolve(__dirname, '..', '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
const CREDIT = '振り仮名パック © 2026 wyichojime（CC BY-SA 4.0）。JMdict/JMnedict/KANJIDIC2 © EDRDG（CC BY-SA 4.0）を利用';

describe('データのライセンス表記', () => {
  it('data/LICENSE は CC BY-SA 4.0 と利用許諾の URL・クレジットの表示例を持つ', () => {
    const license = read('data/LICENSE');
    expect(license).toContain('CC BY-SA 4.0');
    expect(license).toContain('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(license).toContain('振り仮名パック © 2026 wyichojime（CC BY-SA 4.0）');
    expect(license).toContain('JMdict / JMnedict / KANJIDIC2 © Electronic Dictionary Research and Development Group（CC BY-SA 4.0）を利用');
  });

  it('README.md と data/README.md に同じクレジットの表示例がある', () => {
    expect(read('README.md')).toContain(`> ${CREDIT}`);
    expect(read('data/README.md')).toContain(`> ${CREDIT}`);
  });

  it('package.json はコードとデータの両方のライセンスを示し、data/（LICENSE を含む）を配布に入れる', () => {
    const pkg = JSON.parse(read('package.json')) as { license: string; files: string[] };
    expect(pkg.license).toBe('(MIT AND CC-BY-SA-4.0)');
    expect(pkg.files).toContain('data');
    expect(pkg.files).toContain('LICENSE');
  });
});

describe('依存パッケージなし（README）', () => {
  it('JavaScript 版は実行時の依存（dependencies）を持たない', () => {
    const pkg = JSON.parse(read('package.json')) as Record<string, unknown>;
    expect(pkg.dependencies).toBeUndefined();
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.optionalDependencies).toBeUndefined();
  });

  it('Python 版は dependencies が空', () => {
    expect(read('python/pyproject.toml')).toMatch(/^dependencies = \[\]$/m);
  });

  it('C# 版（csharp/FuriganaPack）は NuGet のパッケージを参照しない', () => {
    expect(read('csharp/FuriganaPack/FuriganaPack.csproj')).not.toContain('PackageReference');
  });
});
