# furigana-pack

日本語の文章に振り仮名を付けるライブラリです。形態素解析は使わず、約 19 万語の辞書（振り仮名パック）と文字列を照らし合わせて付けます。

```
その時、彼は… → その｜時《とき》、｜彼《かれ》は…
```

- JavaScript・C#・Python 版があり、どれも同じ結果になります
- 読みが文脈で変わる語（「行った」「昨夜」など）には付けません
- 外部への通信はなく、依存パッケージもありません

[TRPG シナリオツール Scenario Snip](https://wyi.booth.pm/) の振り仮名機能を切り出したものです。

ブラウザで試せるページ: https://furigana.wyichojime.com/ （振り仮名パックもここからダウンロードできます）

## インストール

```bash
npm install github:wyichojime/furigana-pack
```

インストール時に `dist/` がビルドされます。パックのデータを含むため、展開後の大きさは約 14MB です。

## 使い方（JavaScript）

```js
import fs from 'node:fs';
import { loadDictionary, createAnnotator } from 'furigana-pack';

const pack = JSON.parse(fs.readFileSync('node_modules/furigana-pack/data/ruby-pack.json', 'utf8'));
const ruby = createAnnotator(loadDictionary([pack]));

ruby.toHtml('その時、彼は…');   // その<ruby>時<rt>とき</rt></ruby>、…
ruby.toAozora('その時、彼は…'); // その｜時《とき》、…
ruby.ranges('その時、彼は…');   // [{ start: 2, end: 3, reading: 'とき' }, …]
```

`createAnnotator` は辞書の準備に 0.3 秒ほどかかるので、一度作って使い回してください。準備のあとは、2,000 字の文章でも数ミリ秒で終わります。

### 自分の辞書を足す

`loadDictionary` に複数の辞書を渡すと、同じ語は先に渡したほうが使われます。

```js
const mine = [{ text: '暫く', reading: 'しばら(く)' }];
const ruby = createAnnotator(loadDictionary([mine, pack]));
```

読みの `(く)` は、振り仮名を付けない送り仮名の部分です。

### 出力を絞り込む

`ranges()` の結果から一部だけを選び、`rangesToHtml(text, ranges)`・`rangesToAozora(text, ranges)` に渡すと、その分だけ振り仮名を付けた文字列を作れます。

### `<script>` で読み込む

ビルドの仕組みがない環境では、`dist/furigana-pack.global.js` を読み込むとグローバル変数 `FuriganaPack` が使えます。

```html
<script src="furigana-pack.global.js"></script>
<script>
  const ruby = FuriganaPack.createAnnotator(FuriganaPack.loadDictionary([pack]));
</script>
```

TypeScript で `FuriganaPack` の型を使うときは `import type {} from 'furigana-pack/global';` を書いてください。

## C# 版

`csharp/FuriganaPack/` の `.cs` ファイルをプロジェクトにコピーして使います。.NET 8 以降で、依存パッケージはありません。

```csharp
using FuriganaPack;

var ruby = Annotator.FromCompiledFile("data/compiled/ruby-pack.json");
string html = ruby.ToHtml("その時、彼は…");
string aozora = ruby.ToAozora("その時、彼は…");
var ranges = ruby.Ranges("その時、彼は…");
```

埋め込みリソースから読むときは `CompiledLoader.FromCompiled(TextReader)` を使います。

## Python 版

Python 3.10 以降で、標準ライブラリだけで動きます。

```bash
pip install ./python
```

```python
from furigana_pack import Annotator

ruby = Annotator.from_compiled_file("data/compiled/ruby-pack.json")
ruby.to_html("その時、彼は…")
ruby.to_aozora("その時、彼は…")
ruby.ranges("その時、彼は…")
```

`ranges` の位置はコードポイント単位です。JavaScript・C# と同じ UTF-16 単位の位置が欲しいときは `match_ranges_utf16` を使ってください。パックのデータは `pip install` に含まれないので、`data/compiled/ruby-pack.json` をコピーして使ってください。

### C#・Python 版の制限

C#・Python 版が読むのは、変換済みのデータ（`data/compiled/`）だけです。自分の辞書を足すことはできません。

## データ

| ファイル | 内容 |
| --- | --- |
| `data/ruby-pack.json` | 振り仮名パック本体 |
| `data/compiled/ruby-pack.json` | C#・Python 版用に変換したもの |

パックの作り方と正確さは [data/README.md](data/README.md) にまとめています。

## 開発

```bash
npm test                    # ビルドとテスト
npm run typecheck
npm run test:csharp
npm run test:python
npm run security            # 依存パッケージの脆弱性を調べる（npm・NuGet）
npm run demo:serve          # 試用ページを http://localhost:8787/ で開く
npm run demo:deploy:production  # 試用ページを公開する（コミット済みの内容だけ）
```

`tests/conformance/` に 3 つの版で共通のテストデータがあり、JavaScript・C#・Python で結果が一致することを確かめています。

パックを編集したら、次の順にコマンドを実行してください。

```bash
npm run conformance:packs   # テストの期待値を作り直す
npm run compile:data        # data/compiled/ を作り直す
npm test
```

GitHub Actions（`.github/workflows/ci.yml`）が、main への push と毎週月曜に、テストと `npm run security` を流します。依存の更新は Dependabot が月に 1 回 PR にします。脆弱性の報告先は [SECURITY.md](SECURITY.md) です。

コード中の `RUBY-015` などは、Scenario Snip の振り仮名機能の仕様番号です。

## ライセンス

- コード: MIT License（[LICENSE](LICENSE)）
- パックのデータ（`data/`）: CC BY-SA 4.0（[data/LICENSE](data/LICENSE)）

データを配布するときは、次のようなクレジットを表示してください。改変したデータは同じ CC BY-SA 4.0 で公開してください。パックを読み込むアプリのコードには、CC BY-SA は適用されません。

> 振り仮名パック © 2026 wyichojime（CC BY-SA 4.0）。JMdict/JMnedict/KANJIDIC2 © EDRDG（CC BY-SA 4.0）を利用
