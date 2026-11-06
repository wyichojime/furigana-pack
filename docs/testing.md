# テストの手引き（furigana-pack）

共通の手順（何を自動テストにするか・影響範囲の探索的テスト・テストの点検と削除・完了報告の形）は、作者の共通スキル test-care に従う。ここには furigana-pack 固有のことだけを書く。一致テストのデータ（`tests/conformance/`）の中身と作り直し方は [tests/conformance/README.md](../tests/conformance/README.md)、パックを編集したあとの手順は [README.md](../README.md) の「開発」を見る。

## コマンド

| いつ | コマンド | 中身 |
| --- | --- | --- |
| ふだん（変更のたび） | `npm test` | ビルドしてから vitest（`tests/unit/`・`tests/demo/`）。約 1 分 |
| ふだん（変更のたび） | `npm run typecheck` | 型チェック（`src/`・`tests/`・`demo/src/`） |
| C#・Python を変えたとき、パックを直したとき | `npm run test:python`・`npm run test:csharp` | Python は約 1〜2 分。C# は dotnet（.NET 8）が要る。dotnet の無い所では動かせないので、CI の結果で確かめる |
| パックを直したとき | `npm run compile:check` | `data/compiled/` が `data/ruby-pack.json` から作り直した最新のものか（書かずに比べる。古ければ失敗） |
| 念入り（リリース前） | 上の全部と `npm run security` | `security` は依存の脆弱性を調べる（通信する。テストではない） |
| 1つだけ | `npx vitest run tests/unit/pack-data.test.ts` | `dist/` を読むテスト（`dist.test.ts`・`package.test.ts`）は先に `npm run build` |
| 1つだけ（Python） | `python -m unittest discover -s python/tests -t python -p test_loader.py` | |
| 1つだけ（C#） | `dotnet test csharp/FuriganaPack.Tests/FuriganaPack.Tests.csproj --filter LoaderTests` | |

CI（`.github/workflows/ci.yml`）は main への push・PR・毎週月曜に、`npm test`・`typecheck`・`compile:check`・C#・Python のテストと `security` を流す。`csharp/FuriganaPack.WpfCheck`（net8.0-windows）は Linux で作れないので CI では作らない。

## テストの種類と置き場所

- 一致テスト（3 つの版で共通のデータ）: `tests/conformance/*.jsonl`。期待値は参照実装（Scenario Snip）で作ったもので、このライブラリでは作り直さない（パックに依存する `corpus.jsonl`・`variants-packs.json` を除く）
  - JavaScript: `tests/unit/conformance.test.ts`・`compiled.test.ts`・`compiled-cases.test.ts`・`annotator.test.ts`
  - C#: `csharp/FuriganaPack.Tests/ConformanceTests.cs`
  - Python: `python/tests/test_conformance.py`
- 単体（JavaScript）: `tests/unit/`。辞書の読み込み（`dictionary.test.ts`）、照合の索引（`match-index.test.ts`）、関数のソースだけで動くか（`serialize.test.ts`）、パックの読み誤りの回帰（`pack-regressions.test.ts`）
- 配布の形: `tests/unit/dist.test.ts`（`dist/` の 2 つの版）・`package.test.ts`（`exports` と、使う側から型が通るか。`tests/types/` を tsc にかける）
- リポジトリの約束: `tests/unit/pack-data.test.ts`（パックの形）・`license.test.ts`（ライセンス表記・依存なし）・`no-network.test.ts`（通信しない）
- 読み込み・描画（C#・Python）: `LoaderTests.cs`・`AnnotatorTests.cs`、`test_loader.py`・`test_annotator.py`
- 速さ: `PerformanceTests.cs`（1 文の平均 2ms 未満）・`test_performance.py`（5ms 未満）。遅い機械では落ちることがある
- 試用ページ: `tests/demo/`（`build.test.ts` は `dist-demo/` を作って、CSP・クレジット・置くファイルを確かめる）

## 必ず自動テストで守る約束

| 約束 | 守っているテスト |
| --- | --- |
| JavaScript・C#・Python が同じ結果を返す（位置・読み・`toAozora`・`toHtml`） | 一致テスト（上の 3 つ）。C# と Python は件数（4,204 件・115 件）も確かめる |
| 照合と記法の解釈が参照実装（Scenario Snip）と 1 文字も違わない | `conformance.test.ts`（`unit.jsonl`・`random.jsonl`・`variants.jsonl`） |
| 壊れた・改ざんされた解釈済みの形は、3 つの版のどれも読み込みで拒否する | `compiled.test.ts`・`ConformanceTests.cs`・`test_conformance.py`（`compiled-invalid.jsonl`） |
| `data/compiled/` は `data/ruby-pack.json` から作った最新のもの | `npm run compile:check`・`compiled.test.ts` |
| パックは `version` 1・`rubyDictionary` の各語が空でない `text`・`reading` を持つ（Scenario Snip のインポートで読める形） | `pack-data.test.ts` |
| 同じ文字列に 2 つの読みを持たせない（data/README.md の「収録の決まり」） | `pack-data.test.ts`（同じ `text` が 2 回出ない） |
| データは CC BY-SA 4.0。`data/LICENSE`・README・data/README.md にクレジットの表示例を残す | `license.test.ts` |
| 試用ページのライセンスのページにクレジットを残す | `tests/demo/build.test.ts` |
| 依存パッケージなし（JavaScript・C#・Python） | `license.test.ts`（Python は `npm run security` も見る） |
| ライブラリは外部と通信しない | `no-network.test.ts`（3 つの版のソースに通信の API が無い） |
| パックで見つけた読み誤りを二度出さない | `pack-regressions.test.ts` |
| 送り仮名には振り仮名を付けない | なし（候補。いまは一致テストの期待値に含まれるだけ） |

約束を足したら、この表にテストと一緒に 1 行足す。

## 探索的テストの動かし方

- 試用ページ: `npm run demo:serve` で `http://localhost:8787/` を開く（`dist-demo/` を作ってから配信する。`_headers` は解釈しないので、CSP は index.html の meta だけが効く）
- 本文を貼って振り仮名を確かめるときは、青空文庫の例文（`tests/conformance/corpus/`）と、シナリオ文（`corpus/sample_scenario.txt`）の両方を使う
- 壊れやすい所・気をつける所
  - 位置の単位: JavaScript・C# は UTF-16、Python の `ranges` はコードポイント（`match_ranges_utf16` は UTF-16）。サロゲートペアの字（𠮟 など）や絵文字を含む本文で確かめる
  - 規則の語（`者+直前漢字` など）と、送り仮名の付く動詞の形のぶつかり（`pack-regressions.test.ts` の冒頭の説明）
  - 本文で既に振り仮名の付いた箇所（`｜漢字《かんじ》`）に重ねて付けない
  - `toHtml` のエスケープ（`<`・`&` を含む本文や読み）
  - 解釈済みの形の BOM・CRLF・途中で切れたファイル
  - パックを直したら `npm run conformance:packs` → `npm run compile:data` → `npm test` の順。`corpus.jsonl` の差分（読みが変わった箇所）を目で読んで、狙った直しだけか確かめる
