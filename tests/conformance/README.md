# 一致テストのデータ

振り仮名の照合が、Scenario Snip（`meta.json` の `referenceCommit`）の実装と 1 文字も違わないことを確かめるデータ。
期待値は参照実装で作ったもので、このライブラリの実装では作り直さない。照合の決まりを意図して変えるときだけ、変えた理由を記録したうえで作り直す。
例外はパックの中身に依存する `corpus.jsonl`・`variants-packs.json` で、パックを直したらライブラリで作り直す（下の「作り直し」）。

| ファイル | 中身 |
| --- | --- |
| `unit.jsonl` | Scenario Snip の unit テストが渡した辞書と本文（`scripts/record/` で記録） |
| `variants.jsonl` | 記法の解釈（`resolveVariants`）の入力と結果（unit テストの記録と、乱数の辞書の全語） |
| `variants-packs.json` | パック全語（`ruby-pack.json`）の `resolveVariants` の結果を要約したもの。`count`（語数）と `sha256`（`JSON.stringify(各語の結果 ?? null の配列)` の SHA-256） |
| `random.jsonl` | 記法を組み合わせた辞書と本文（種 20261002、3,000 件） |
| `corpus.jsonl` | パック全体（`dictRef`）を本文（`corpus/`）に当てた結果。本文は約 5,000 字ごとに分けている |
| `compiled-cases.jsonl` | unit・random の各ケースの辞書を解釈済みの形にしたもの（C# 版など記法を解釈しない実装用。`npm run conformance:compiled` で作る。期待値は元のケースのまま） |
| `render-cases.jsonl` | `toAozora`・`toHtml` の出力（`{"id","dict","text","aozora","html"}`）。記法を壊す読み・親文字の語と、本文で既に振り仮名の付いた箇所に付けないことを確かめる。手で書き、期待値は 1 件ずつ目で確かめたもの |
| `compiled-render-cases.jsonl` | `render-cases.jsonl` の辞書を解釈済みの形にしたもの（C#・Python 版用。`npm run conformance:compiled` で作る） |
| `compiled-invalid.jsonl` | 読み込みで拒否しなければならない、壊れた・改ざんされた解釈済みの形（`{"id","lines"}`）。JS・C#・Python のどれも例外にする |

- 1 行 1 ケース。照合のケースは `{"id","dict"|"dictRef","text","expected":[[start,end,reading],...]}`。位置は UTF-16 の添字（Python ではコードポイントから変換して比べる）。
- `corpus/sample_scenario.txt` は Scenario Snip の自作の例文。`corpus/aozora/` は青空文庫（著作権の切れた作品）から記法を取り除いたもの（出典は `corpus/aozora/README.md`）。
## 作り直し

### パックを直したとき（`corpus.jsonl`・`variants-packs.json` だけ）

この 2 つはパックの中身に依存するので、パックを直したら `npm run conformance:packs` で作り直す。
期待値はこのライブラリ（`dist/furigana-pack.mjs`）で作る。照合と記法の解釈の決まりは参照実装で作った
`unit.jsonl`・`random.jsonl`・`variants.jsonl` で固定しているので、それらが通る限りパックに依存する期待値はライブラリで作ってよい。
パックが変わっていなければ、作り直しても 2 つのファイルはバイト単位で変わらない。

### 照合の決まりを作り直すとき（全部）

参照実装（Scenario Snip の `_app/lib/app/ruby-manager.js` が照合を持っていた版。`meta.json` の `referenceCommit`）を
`git worktree add <場所> <コミット>` などで取り出し、その unit テストを走らせて呼び出しを記録してから作る。

```bash
# 1. 記録（Scenario Snip の test/ で、その node_modules の vitest を使う）。_recorded.jsonl は git に入れない
cd <参照実装>/test
SS_DIR=<参照実装> RECORD_OUT=<このリポジトリ>/tests/conformance/_recorded.jsonl   npx vitest run --config <このリポジトリ>/scripts/record/vitest.record.config.mjs
# 2. 生成（unit・variants・random・corpus・variants-packs・meta）
node scripts/make-conformance.mjs --reference <参照実装> --reference-commit <コミット>
```

記録を始める前に、古い `_recorded.jsonl` は消しておく（追記されるため）。
