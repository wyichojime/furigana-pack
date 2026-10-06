// デモの worker の処理本体（postMessage から切り離して Node でテストする）。
// パックの読み込み・辞書の準備・照合・難読語の絞り込み・出力。拡張機能の offscreen document でも使う。
import { createAnnotator, loadDictionary, rangesToAozora, rangesToHtml, type Annotator } from '../../src/index';
import { countKanji, filterDifficult } from './difficult';

export type PackName = 'ruby-pack.json';
export interface AnnotateRequest { type: 'annotate'; id: number; text: string; difficultOnly: boolean }
export interface AnnotateResult { type: 'result'; id: number; html: string; aozora: string; kanjiCount: number; rubyKanjiCount: number }
export interface StatusMessage { type: 'status'; state: 'loading' | 'ready' | 'error'; message?: string }

export interface Engine {
  annotator(): Promise<Annotator>;
  isReady(): boolean;
  annotate(req: AnnotateRequest): Promise<AnnotateResult>;
}

export function createEngine(fetchPack: (name: PackName) => Promise<unknown>): Engine {
  // 失敗した Promise は保持しない（次の呼び出しでやり直す）
  let pending: Promise<Annotator> | undefined;
  let done = false;
  const annotator = () => {
    pending ??= fetchPack('ruby-pack.json')
      .then((pack) => createAnnotator(loadDictionary([pack])))
      .then(
        (a) => {
          done = true;
          return a;
        },
        (e) => {
          pending = undefined;
          throw e;
        },
      );
    return pending;
  };
  return {
    annotator,
    isReady: () => done,
    async annotate(req) {
      const a = await annotator();
      const all = a.ranges(req.text);
      const ranges = req.difficultOnly ? filterDifficult(req.text, all) : all;
      return {
        type: 'result',
        id: req.id,
        html: rangesToHtml(req.text, ranges),
        aozora: rangesToAozora(req.text, ranges),
        kanjiCount: countKanji(req.text),
        rubyKanjiCount: ranges.reduce((n, r) => n + countKanji(req.text.slice(r.start, r.end)), 0),
      };
    },
  };
}
