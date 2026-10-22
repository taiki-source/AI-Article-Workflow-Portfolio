# AI Article Workflow Portfolio

OpenAI Responses API と Google Sheets を組み合わせ、記事の生成、修正、人間承認、保存を段階的に扱う Node.js サンプルです。AI出力は下書きであり、保存の判断は人間が行います。

## 実証済みの安全機能

- `L2:V` を走査し、固定行ではなく状態に応じた対象行を選択
- 状態判定を `src/portfolio-row-workflow.js` に共通化
- `L1:V1` の列名・順序を検証。不一致なら生成、修正、保存を停止
- AI実行・Sheets書込みフラグを拒否する読み取り専用ドライラン
- 未承認記事の保存防止、保存済み行の `SKIP` による再保存防止
- 保存直前の再読込と承認状態再確認、保存後の照合

実シートで、生成、修正、承認前保存防止、承認済み修正版の保存、再実行時の `SKIP` を確認済みです。

## 列構成

| 列 | 内容 |
| --- | --- |
| L | テーマ |
| M:N | 初回生成記事 |
| O | 初回判定（承認・修正・却下） |
| P | 修正指示 |
| Q:R | 修正版記事 |
| S | 修正後判定（承認・修正・却下） |
| T:V | 保存状態・保存済みタイトル・保存済み本文 |

主な状態は `GENERATE`、`WAIT_REVIEW`、`REVISE`、`SAVE_ORIGINAL`、`SAVE_REVISED`、`SKIP` です。生成・修正は対象の先頭1行、保存は承認済みかつ未保存の行を扱います。

## セットアップ

```powershell
npm install
Copy-Item .env.example .env
```

`.env` の値は公開しません。

```text
OPENAI_API_KEY=
GOOGLE_SPREADSHEET_ID=
GOOGLE_CREDENTIALS_PATH=
```

### 認証JSONの保管

Googleサービスアカウントの認証JSONは、リポジトリ内の
`credentials/service-account.json` にだけ保存してください。
`credentials/` 配下はGitで除外されるため、認証JSONをコミットしたり共有したりしません。

`.env` の `GOOGLE_CREDENTIALS_PATH` には、次のようにこのローカルパスを設定します。

```text
GOOGLE_CREDENTIALS_PATH=credentials/service-account.json
```

プログラムはこの環境変数で指定されたパスを使用するため、既存の認証ファイル参照方法は変わりません。

## 実行

```powershell
# 読み取り専用
npm run dry-run
npm run generate:dry
npm run revise:dry
npm run save:dry

# 明示的な実行（API利用・Sheets書込みあり）
node src/portfolio-generate.js --generate
node src/portfolio-revise.js --revise
node src/portfolio-save-execute.js --write
```

生成・修正には費用が発生し得るため、必ずドライランと人間レビューを先に行ってください。

## ローカル検証

```powershell
npm test
npm run check
```

これらはモックデータまたは構文検査だけを使用し、OpenAI APIとGoogle Sheetsには接続しません。

## 未対応・今後の改善

- 再々修正用の専用指示欄と状態遷移
- 複数対象のキュー制御
- 同時編集に対する完全な排他制御
- 実行ログ、通知、再試行
- ワンコマンド実行、費用・業務効果の測定

実運用では、最小権限、監査ログ、入力検証、例外通知を追加してください。
