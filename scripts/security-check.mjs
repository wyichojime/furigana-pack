// 依存パッケージの脆弱性をまとめて調べる（npm run security）。CI（.github/workflows/ci.yml）でも毎週流す。
//   npm   … npm audit。moderate 以上があれば失敗（low は表示だけ）
//   NuGet … dotnet list package --vulnerable（推移的な依存も含む）。1 件でもあれば失敗。dotnet が無ければ飛ばす
//   Python… 実行時の依存は無い（python/pyproject.toml の dependencies = []）。増えていないことだけ確かめる
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Windows では npm・dotnet がシェル経由でしか起動できないため shell を使う（引数は固定の文字列だけ）
const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32' });
let failed = false;

// ---- npm ----
{
  const r = run('npm', ['audit', '--json']);
  const counts = JSON.parse(r.stdout).metadata.vulnerabilities;
  const serious = counts.moderate + counts.high + counts.critical;
  console.log(`npm: low ${counts.low}・moderate ${counts.moderate}・high ${counts.high}・critical ${counts.critical}`);
  if (serious > 0) {
    failed = true;
    console.log('  → npm audit で中身を確かめ、npm audit fix か依存の更新で直してください');
  }
}

// ---- NuGet ----
{
  const hasDotnet = spawnSync('dotnet', ['--version'], { encoding: 'utf8', shell: process.platform === 'win32' }).status === 0;
  if (!hasDotnet) {
    console.log('NuGet: dotnet が無いので飛ばしました');
  } else {
    // WpfCheck（net8.0-windows）は Windows 以外で復元できないため、Windows のときだけ含める
    const projects = ['csharp/FuriganaPack/FuriganaPack.csproj', 'csharp/FuriganaPack.Tests/FuriganaPack.Tests.csproj'];
    if (process.platform === 'win32') projects.push('csharp/FuriganaPack.WpfCheck/FuriganaPack.WpfCheck.csproj');
    for (const project of projects) {
      execFileSync('dotnet', ['restore', project], { cwd: root, stdio: 'ignore', shell: process.platform === 'win32' });
      const r = run('dotnet', ['list', project, 'package', '--vulnerable', '--include-transitive', '--format', 'json']);
      const found = [];
      for (const p of JSON.parse(r.stdout).projects ?? [])
        for (const fw of p.frameworks ?? [])
          for (const pkg of [...(fw.topLevelPackages ?? []), ...(fw.transitivePackages ?? [])])
            found.push(`${pkg.id} ${pkg.resolvedVersion}（${(pkg.vulnerabilities ?? []).map((v) => v.severity).join('・')}）`);
      console.log(`NuGet: ${path.basename(project)} ${found.length ? found.join('、') : '0 件'}`);
      if (found.length) failed = true;
    }
  }
}

// ---- Python ----
{
  const toml = fs.readFileSync(path.join(root, 'python', 'pyproject.toml'), 'utf8');
  if (/^dependencies\s*=\s*\[\s*\]/m.test(toml)) {
    console.log('Python: 実行時の依存なし');
  } else {
    failed = true;
    console.log('Python: pyproject.toml に依存が増えています。pip-audit で調べ、このスクリプトも直してください');
  }
}

if (failed) {
  console.log('\n脆弱性（または確かめていない依存）が見つかりました。');
  process.exit(1);
}
console.log('\n問題は見つかりませんでした。');
