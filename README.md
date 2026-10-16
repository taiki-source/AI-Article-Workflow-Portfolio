
# AI記事制作・承認ワークフロー

## 概要

OpenAI APIとGoogle Sheetsを連携し、記事の生成・修正・承認・保存を支援する業務効率化システムです。

AIによる作業の効率化と、人間による品質確認を組み合わせています。

## 解決したい課題

- 記事作成や修正にかかる作業負担
- 記事の承認状況が分かりにくい
- 保存済み記事の重複処理
- 未承認記事の誤保存

## 主な機能

1. Google Sheetsから記事テーマを取得
2. OpenAI APIで記事を生成
3. 人間が記事を確認し、承認・修正・却下を判断
4. 修正指示に基づいてAIが記事を修正
5. 人間による最終承認
6. 承認済み記事をGoogle Sheetsへ保存
7. 保存済み記事の再処理を防止

## 使用技術

- JavaScript / Node.js
- OpenAI Responses API
- gpt-5-nano
- Google Sheets API
- dotenv

## 処理フロー

テーマ入力
→ AI記事生成
→ 人間による確認
→ 必要に応じてAI修正
→ 最終承認
→ Google Sheetsへ保存

## 動作検証

- AI記事生成：実行成功
- AI記事修正：実行成功
- Google Sheetsへの保存：成功
- 保存後のデータ照合：成功
- 保存済み記事の再実行：SKIPを確認

## 現在の制約

- 複数のコマンドを順番に実行する構成
- 記事の確認と承認は人間が担当
- 同時編集による競合を完全には防げない
- 修正後の再々修正は未対応
- 業務削減時間は未計測

## 今後の改善

- ワンコマンドでの操作
- 複数記事の一括処理
- 実行ログとエラー通知
- 業務削減効果の測定


## セットアップ方法

### 1. 必要な環境

- Node.js
- npm
- OpenAI APIキー
- Google Sheets APIを利用できるGoogleサービスアカウント
- サービスアカウントに共有されたGoogleスプレッドシート

### 2. インストール

プロジェクトのフォルダーで実行します。

```powershell
npm install
```

### 3. 環境変数の設定

```powershell
Copy-Item .env.example .env
```

`.env` に以下を設定します。

- `OPENAI_API_KEY`：OpenAI APIキー
- `GOOGLE_SPREADSHEET_ID`：使用するスプレッドシートID
- `GOOGLE_CREDENTIALS_PATH`：Google認証JSONファイルのパス

認証ファイルや `.env` は公開しないでください。

### 4. スプレッドシートの準備

記事データにはL〜V列を使用します。

| 列 | 内容 |
|---|---|
| L | 記事テーマ |
| M | AI生成タイトル |
| N | AI生成本文 |
| O | 初回承認判断 |
| P | 修正指示 |
| Q | AI修正後タイトル |
| R | AI修正後本文 |
| S | 修正後の承認判断 |
| T | 保存状態 |
| U | 承認済みタイトル |
| V | 承認済み本文 |

承認判断には「承認」「修正」「却下」を使用します。

### 5. 実行方法

状態確認（読み取り専用）：

```powershell
npm run status
```

記事生成の事前確認：

```powershell
npm run generate:dry
```

記事生成の実行：

```powershell
node src/portfolio-generate.js --generate
```

AI修正の事前確認：

```powershell
npm run revise:dry
```

AI修正の実行：

```powershell
node src/portfolio-revise.js --revise
```

承認済み記事の保存確認：

```powershell
npm run save:dry
```

承認済み記事の保存：

```powershell
node src/portfolio-save-execute.js --write
```

記事生成・AI修正ではOpenAI APIの従量課金が発生します。

**現行の生成・修正処理は8行目、保存処理は6〜8行目を対象としています。** 任意の行を自由に処理する汎用版ではありません。

## 安全上の注意

- 初期状態ではドライランを使用してください
- AI生成記事は必ず人間が確認してください
- 保存済み記事は再実行時にSKIP判定されます
- 同時編集に対する完全な排他制御はありません
- 実運用前には権限管理や例外処理の追加が必要です

