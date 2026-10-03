// デモの Web Worker の入口。処理は worker-core.ts、ここは postMessage の受け渡しだけ。
import { createEngine, type AnnotateRequest, type StatusMessage } from './worker-core';

const ctx = self as unknown as {
  postMessage(message: unknown): void;
  onmessage: ((e: MessageEvent<AnnotateRequest>) => void) | null;
};
const status = (state: StatusMessage['state'], message?: string) =>
  ctx.postMessage({ type: 'status', state, message } satisfies StatusMessage);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const engine = createEngine(async (name) => {
  const res = await fetch(`data/${name}`);
  if (!res.ok) throw new Error(`${name} を読み込めませんでした（HTTP ${res.status}）`);
  return res.json();
});

status('loading', '辞書を準備中…');
engine.annotator().then(
  () => status('ready'),
  (e) => status('error', errorText(e)),
);

ctx.onmessage = async (e) => {
  const req = e.data;
  try {
    if (!engine.isReady()) status('loading', '辞書を準備中…');
    const result = await engine.annotate(req);
    status('ready');
    ctx.postMessage(result);
  } catch (err) {
    status('error', errorText(err));
  }
};
