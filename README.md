# デリバリー管理ダッシュボード

社内のデリバリー（案件・アサイン）状況を可視化するダッシュボード。
従来のスプレッドシート（案件管理表・アサイン表・スキルマトリクス）を正規化したデータベースに移行し、アプリを正本として運用する。

## 技術構成

| 区分 | 技術 |
|---|---|
| フロントエンド | Next.js 16 (App Router) / TypeScript / Tailwind CSS |
| DB・認証 | Supabase（プロジェクト: `delivery-dashboard`, 東京リージョン） |
| ホスティング | Vercel |
| 認証方式 | Googleログイン＋マジックリンク（`rechroma.co.jp` ドメイン限定） |

## 機能（v1）

- **稼働ダッシュボード**（`/`）: メンバー別のアサイン案件数・実質稼働数（レビュー/サポート除く）・役割内訳。アサイン未登録案件のアラート
- **案件一覧**（`/projects`）: アクティブ案件を終了予定月ごとにグルーピング表示。支援メニュー・アサイン役割バッジ付き
- **メンバー詳細**（`/members/[id]`）: 対応可能メニュー（スキルマトリクス）と担当案件履歴

## データモデル

```
clients（顧客） ─< projects（案件） >─ project_menus ─ menus（支援メニュー）
                        │
                  assignments（案件×メンバー×役割: PM/Main/Sub/Review/Support/PM・Main兼任）
                        │
                  members（メンバー） ─< skills（メニュー対応可否: main/sub）
```

- 全テーブルにRLSを適用。`@rechroma.co.jp` の認証済みユーザーのみアクセス可（`is_internal_user()`）
- 案件ID・顧客IDは既存スプレッドシートの採番を踏襲

## 開発

```bash
npm install
cp .env.example .env.local  # SupabaseのURLとanon keyを設定
npm run dev
```

## CSVインポート（初期移行）

既存スプレッドシートのCSVを `data/raw/` に配置して実行する（`data/` はコミット禁止）。

```bash
python3 scripts/import_csv.py   # data/seed/*.sql を生成
# 生成されたSQLを 01→07 の順でSupabaseに適用
```

クレンジング内容: メニュー名の表記ゆれ統一（SBT→SBTi 等）、氏名の空白正規化、日付形式の補正、セル内改行の除去、空行スキップ。

## 認証の初期設定（Supabaseダッシュボード）

1. Authentication → Providers → Google を有効化（Google Cloud ConsoleでOAuthクライアントを作成し、Client ID/Secretを設定）
2. Authentication → URL Configuration → Site URL に本番URLを設定し、`https://<本番ドメイン>/auth/callback` をRedirect URLsに追加

マジックリンク（メールOTP）はデフォルトで有効（Supabase組み込みメールは送信レート制限あり）。
