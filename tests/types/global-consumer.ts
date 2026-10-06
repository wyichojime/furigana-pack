// <script> 版（グローバル FuriganaPack）の型の確認。
import type {} from 'furigana-pack/global';
const annotator = FuriganaPack.createAnnotator(FuriganaPack.loadDictionary([[{ text: '漢字', reading: 'かんじ' }]]));
const html: string = annotator.toHtml('漢字');
export { html };
