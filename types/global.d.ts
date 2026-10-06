// <script src="furigana-pack.global.js"> で読み込んだときのグローバル FuriganaPack の型。
// 使う側は import type {} from 'furigana-pack/global'; で型だけを読み込む。
declare global {
  var FuriganaPack: typeof import('../dist/types/index');
}
export {};
