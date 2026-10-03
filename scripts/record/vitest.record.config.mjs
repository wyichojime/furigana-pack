import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ss = process.env.SS_DIR;
if (!ss) throw new Error('SS_DIR（Scenario Snip のリポジトリ）を指定してください');
const here = path.dirname(fileURLToPath(import.meta.url));

export default {
  root: path.join(ss, 'test'),
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: 1,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: [path.join(ss, 'test', 'setup.ts'), path.join(here, 'recorder.mjs')],
    include: ['unit/**/*.test.{js,ts}'],
    exclude: ['e2e/**', 'unit/agent-loop.test.ts'],
  },
  resolve: { alias: { '@': ss } },
};
