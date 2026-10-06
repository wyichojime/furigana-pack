// Web デモを組み立てて Cloudflare へ公開する。作業中の変更を出さないよう、未コミットの変更があれば止める。
//   node scripts/deploy-demo.mjs staging    … Worker furigana-pack-dev（workers.dev。Access で作者だけ。検索にも載せない）
//   node scripts/deploy-demo.mjs production … Worker furigana-pack（furigana.wyichojime.com）
// 設定は demo/wrangler.jsonc
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TARGETS = {
  staging: {
    build: [],
    deploy: ['deploy', '--config', 'demo/wrangler.jsonc', '--env', 'staging'],
  },
  production: {
    build: ['--production'],
    // --env= は「環境の指定なし（最上位の設定）」をはっきり示す（環境が複数あると wrangler が警告するため）
    deploy: ['deploy', '--config', 'demo/wrangler.jsonc', '--env='],
  },
};
const name = process.argv[2];
const target = TARGETS[name];
if (!target) {
  console.error('使い方: node scripts/deploy-demo.mjs staging|production');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirty = execFileSync('git', ['-c', 'safe.directory=*', 'status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim();
if (dirty) {
  console.error(`未コミットの変更があるため公開しません。コミットしてからやり直してください。\n${dirty}`);
  process.exit(1);
}

execFileSync(process.execPath, [path.join(root, 'scripts', 'build-demo.mjs'), ...target.build], { cwd: root, stdio: 'inherit' });
execFileSync('npx', ['wrangler', ...target.deploy], { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' });
