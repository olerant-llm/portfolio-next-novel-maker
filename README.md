# Next Novel Maker — 台本処理エンジンの試作

分岐付きの教材台本を読み取り、書式の誤りや未定義の登場人物を確認するエンジンです。選択肢・変数・条件分岐を進める処理と、再生状態の保存・復元を実装しています。

現時点で公開するのは台本を処理する中核部分です。ADV風・SNS風の再生画面、編集画面、外部Webアプリとの双方向接続、AI草案生成はまだ実装していません。

## 使い方

Node.js 22系以上とnpmを用意し、このフォルダで実行します。最初の操作は必要な部品を取得します。

```powershell
npm install
npm run lint -- content/scenarios/aisatsu_test.scenario.txt content/scenarios/photo_upload.scenario.txt --characters content/characters/ami.yaml content/characters/takeru.yaml
```

台本の書き方は `packages/schema/記法リファレンス.md`、登場人物の設定は `packages/schema/キャラ定義リファレンス.md` を参照してください。`content/` は架空の登場人物による学習用サンプルです。人物画像は同梱していません。

## 実装の場所

- `packages/core/src/parser.ts`: 台本の読み取りと参照確認
- `packages/core/src/runtime.ts`: 選択肢・変数・進行、状態の保存と復元
- `packages/core/src/cli.ts`: 台本をコマンドから確認する入口
- `packages/core/src/index.ts`: 他のプログラムから使う入口

元版では自動確認4件とサンプル2本の書式確認が成功した記録があります。公開用コピーでは確認を実行していません。

MIT License。本文は [LICENSE](LICENSE) を参照してください。

