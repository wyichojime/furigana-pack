// デモの画面の操作。照合は worker.js（worker-core.ts）に任せ、ここは入力・切り替え・表示・コピーだけ。
import type { AnnotateRequest, AnnotateResult, StatusMessage } from './worker-core';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = $<HTMLTextAreaElement>('input');
const statusEl = $<HTMLParagraphElement>('status');
const stats = $<HTMLParagraphElement>('stats');
const view = $<HTMLDivElement>('view');
const aozora = $<HTMLTextAreaElement>('aozora');
const html = $<HTMLTextAreaElement>('html');
const copied = $<HTMLParagraphElement>('copied');

const worker = new Worker('worker.js');
let latestId = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

const difficultOnly = () => (document.querySelector('input[name="scope"]:checked') as HTMLInputElement).value === 'difficult';

function request() {
  clearTimeout(timer); // 打ちかけの予約は、この依頼で済む
  latestId += 1;
  const req: AnnotateRequest = { type: 'annotate', id: latestId, text: input.value, difficultOnly: difficultOnly() };
  worker.postMessage(req);
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(request, 300);
}

function showStatus(msg: StatusMessage) {
  statusEl.classList.toggle('error', msg.state === 'error');
  statusEl.textContent = msg.state === 'ready' ? '' : msg.state === 'error' ? `読み込めませんでした: ${msg.message ?? ''}` : (msg.message ?? '');
  if (msg.state === 'error') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reload';
    button.textContent = '再読み込み';
    button.addEventListener('click', () => location.reload());
    statusEl.append(button);
  }
}

function showResult(r: AnnotateResult) {
  if (r.id !== latestId) return; // 打ち続けたときの古い結果は捨てる
  view.innerHTML = r.html; // rangesToHtml の出力（本文はエスケープ済み）
  aozora.value = r.aozora;
  html.value = r.html;
  stats.textContent = `漢字 ${r.kanjiCount.toLocaleString()} 字のうち ${r.rubyKanjiCount.toLocaleString()} 字に振り仮名`;
}

worker.addEventListener('message', (e: MessageEvent<StatusMessage | AnnotateResult>) => {
  if (e.data.type === 'status') showStatus(e.data);
  else showResult(e.data);
});
worker.addEventListener('error', () => showStatus({ type: 'status', state: 'error', message: '処理を始められませんでした' }));

input.addEventListener('input', schedule);
for (const radio of document.querySelectorAll<HTMLInputElement>('input[name="scope"]')) radio.addEventListener('change', request);

for (const tab of document.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll<HTMLButtonElement>('[role="tab"]')) {
      const selected = t === tab;
      t.setAttribute('aria-selected', String(selected));
      $(t.getAttribute('aria-controls')!).hidden = !selected;
    }
  });
}

for (const button of document.querySelectorAll<HTMLButtonElement>('.copy')) {
  button.addEventListener('click', async () => {
    const target = $<HTMLTextAreaElement>(button.dataset.copy!);
    try {
      await navigator.clipboard.writeText(target.value);
      copied.textContent = 'コピーしました';
    } catch {
      target.select();
      copied.textContent = 'コピーできませんでした。選択した文字を手でコピーしてください';
    }
    // 続けてコピーしたときも、最後の知らせを 2.5 秒出す
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copied.textContent = ''), 2500);
  });
}

request();
