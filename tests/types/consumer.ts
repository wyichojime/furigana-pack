// 使う側の型の確認（パッケージ名 furigana-pack で読み込み、package.json の exports と types を通る）。
// npm run typecheck:consumer で tsc にかける（実行はしない）。
import { buildMatcher, createAnnotator, loadDictionary, matchRanges, type Annotator, type DictEntry, type RubyRange } from 'furigana-pack';

const user: DictEntry[] = [{ text: '暫く', reading: 'しばら(く)' }];
const dict: DictEntry[] = loadDictionary([user, { rubyDictionary: [] }]);
const ruby: Annotator = createAnnotator(dict);
const ranges: RubyRange[] = ruby.ranges('暫く待つ');
const html: string = ruby.toHtml('暫く待つ');
const aozora: string = ruby.toAozora('暫く待つ');
const again: RubyRange[] = matchRanges(buildMatcher(dict), '暫く');

// @ts-expect-error reading は必須
const bad: DictEntry = { text: '漢字' };
// @ts-expect-error ranges は文字列を受け取る
ruby.ranges(1);

export { ranges, html, aozora, again, bad };
