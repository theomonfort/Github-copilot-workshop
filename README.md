# GitHub Copilot Workshop

ハンズオン教材リポジトリ。`src/content/playbook/` の Markdown と `public/` の画像アセットを題材に、GitHub Copilot を使って playbook landing page を Astro で組み立てます。

## はじめに

1. このリポジトリを **Use this template → Create a new repository** で自分用にコピー
2. **Code → Codespaces → Create codespace on main** で開発環境を起動
3. ワークショップ中に `.github/copilot-instructions.md` と `.github/instructions/frontend.instructions.md` を作成
4. Copilot Chat に「playbook landing page を作る」よう依頼して、`src/content/playbook/` の Markdown を一覧表示するサイトを作成

## 構成

| パス | 内容 |
|---|---|
| `.devcontainer/devcontainer.json` | Codespaces / Dev Containers の定義 |
| `.mcp.json` | Workspace の GitHub MCP Server 設定 (`mcpServers`) |
| `.vscode/settings.json` | Workspace ルートの MCP 設定を有効化 |
| `src/content/playbook/ja/` | 最新の日本語 playbook |
| `src/content/playbook/en/` | 最新の英語 playbook |
| `src/lib/playbook-categories.ts` | category のラベル、説明、actor、avatar、色、表示順のメタデータ |
| `public/` | playbook 用の惑星、Octocat、背景、アイコンなどのサイト用アセット |

> `.github/` 配下の Copilot instruction files は、ワークショップ手順の中で作成します。

## Workspace MCP

現在の VS Code で **Session Target → Copilot** を選び、**Customizations → MCP Servers → Workspace** を開きます。`.vscode/settings.json` で `chat.mcp.workspaceRootConfig.enabled` を有効にしています。対応する VS Code / Copilot のバージョンが必要です。Codespaces でもこの Workspace 設定を使います。

スターターには GitHub MCP (`github-mcp-server`, `https://api.githubcopilot.com/mcp/`) が登録済みです。同じサーバーを追加し直さず、未登録のサーバーを追加する場合だけ **Workspace の + → HTTP** を選び、URL とサーバー名を入力します。保存先はリポジトリルートの **`.mcp.json`** (`mcpServers`) です。**User / Global** は選びません。

サーバーの信頼確認、OAuth 認証などは各自で実施します。接続先 JSON だけで認証済みにはなりません。トークンや API キーをコミットしないでください。

この手順は **Copilot ハーネス**用です。従来の **Local ハーネス**用 `.vscode/mcp.json` (`servers`) とは形式が異なります。この教材では併用せず、同じサーバーの二重登録を避けます。[VS Code の設定先の説明](https://code.visualstudio.com/docs/agent-customization/mcp-servers#_choose-a-configuration-destination)を参照してください。

## チェックポイントから PR を作る / Create a checkpoint PR

**未保存のエディタ内容を保存してから、自分のリポジトリで 1 つ選んで実行します。** Node.js 22.12 以上、Git 2.23 以上、GitHub CLI (`gh`) とサインイン、`origin` への push 権限が必要です。`origin` は自分の GitHub リポジトリを指す HTTPS / SSH URL にしてください。

| コマンド / Command | 再開地点 / Snapshot |
|---|---|
| `./checkpoint1` | 基本サイト + 開発課題の Issue / `checkpoint/01-develop` |
| `./checkpoint2` | プレゼン機能 / `checkpoint/02-cloud-agent` |
| `./checkpoint3` | 3D ギャラクシー + E2E / PR テスト / `checkpoint/03-tests` |

**解析教材 / Analysis exercises:** checkpoint 1 / 2 / 3 には、意図的なセキュリティ問題と品質問題が各 1 / 2 / 3 件、アプリから隔離して含まれます。製品に出荷せず、import / 実行しないでください。Snapshots include cumulative, intentionally flawed static-analysis exercises, not application code. The proof workflow runs only in the canonical template; participant repositories keep their existing CodeQL setup.

**`checkpoint1` のみ:** 事前確認後、stash や checkout の変更前に、自分のリポジトリへ [Part 6 と共通の日本語 Issue 8 件](scripts/checkpoint-issues.json)を準備します。Issues の有効化と `gh` の Issue 読み取り / 作成権限が必要です。既存の open / closed Issue は再利用し、編集内容や状態を変えません。実際の番号と URL を表示するため、Issue 番号を 1 からと仮定しないでください。`checkpoint2` / `checkpoint3` は Issue を作りません。

課題はプレゼンの基本 / 本文 / Mermaid / レスポンシブ (Cloud Agent、checkpoint2)、テスト / CI (Part 11、checkpoint3)、既存 3D ギャラクシーの再現と音声 (Part 13)、日次レポート (Part 14) です。基本サイトは checkpoint1 に含まれるため重複課題にしません。**3D は checkpoint3 に実装済み**です。checkpoint1 / checkpoint2 から手動実装する場合だけ `playbook-3d` に取り組み、checkpoint3 を使う場合は完了条件を確認して既存実装を再利用します。音声 / 日次レポートは snapshot に含まれず、音声は手動 3D PR または checkpoint3 PR のマージ後に進めます。既存 Issue の本文や状態は変えず、自動割り当て・完了処理もしません。

各コマンドは変更済み・未追跡ファイルを必要に応じて名前付き stash に保存し、取得した **自分の `origin/main`** から新しい `workshop-checkpointN` ブランチを作ります。使用済みの名前には `-2` などを付け、既存ブランチは変更しません。

**公式教材 `theomonfort/Github-copilot-workshop` の現在の named checkpoint** を読み取り専用で fetch し、**ファイルの tree だけ**を作業ブランチへ取り込みます。commit → 自分の `origin` へ新規ブランチだけ push → `main` 宛ての PR 作成まで実行し、**merge はしません**。追跡ファイルを checkpoint の tree で置き換えるため、PR の削除差分も確認してください。同じ snapshot が既に `origin/main` にある場合、stash / ブランチ / commit / push / PR は作りませんが、`checkpoint1` は不足する Issue を準備します。

テンプレートからコピーされたブランチは履歴が独立しているため、PR 用に直接 switch / merge しません。**Include all branches は不要**で、`main` だけコピーした repo でも使えます。公式教材自身を `origin` にしての実行は拒否します。

### 保存した作業とエラーからの復帰 / Recovery

Issue の準備に失敗した場合、成功済みの Issue は残し、表示された権限・設定・通信エラーを解消して `./checkpoint1` を再実行してください。checkout の変更前に停止し、再実行時は全状態・全ページから既存 Issue を確認して不足分だけ作成します。応答が失われた場合も、手動で重複作成しないでください。リポジトリ設定は自動変更しません。

本文の `<!-- workshop-issue:KEY -->` またはタイトルの `[playbook:KEY]` を残してください。Git の共通メタデータ内 `workshop-issues/` に番号のローカル記録も保存し、同じ clone での編集後の再実行に使います (commit / stash 対象外)。別 clone ではマーカーが必要です。記録済み Issue の削除 / 移動、重複キー、破損した記録は自動修復せず停止します。古い `.lock` は記載されたプロセスの終了を確認してから削除してください。同じリポジトリへ別 clone からも同時実行しないでください。

stash は自動で戻しません。表示された **stash SHA** と復帰コマンドを保存し、元のブランチへ戻って `git stash apply --index` で復元します。内容を確認するまで stash を削除しないでください。ignored ファイルは stash に含まれず、置き換えに衝突する場合は事前に停止します。

push / PR 作成に失敗しても、自動 reset やブランチ削除はしません。表示された成功済みステップ、commit、再試行コマンドを確認してください。リモートブランチ / PR が既に作られていないか確認してから再試行し、既存ブランチを上書きしないでください。同じ checkout で複数のコマンドを同時実行しないでください。

**English:** Save editor buffers, then run one command above in your own repository (or invoke it by path from another directory). Requires Node.js 22.12+, Git 2.23+, authenticated `gh`, and push access. It saves tracked/untracked edits in a named stash, creates a fresh branch from your current remote `main`, imports only the current canonical checkpoint's files, commits, pushes that new branch, and opens a PR against your `main`. Review the PR, including deletions, and merge it yourself when ready.

Only `checkpoint1` also prepares the eight Japanese build-step issues from the current canonical catalogue, before stashing or changing the checkout. It requires Issues enabled and read/create access, reuses open/closed issues without editing or reopening them, and prints their actual numbers/URLs. Presentation work maps to checkpoint2; tests/CI and visual 3D are included in checkpoint3. Build 3D manually from checkpoint1/2, or inspect and reuse checkpoint3 instead. Audio and daily reporting remain separate extensions; start audio after merging either the manual 3D PR or checkpoint3 PR. Existing issue bodies and states are preserved; no automatic assignment or completion is triggered. `checkpoint2` and `checkpoint3` never seed issues.

Copied template branches have unrelated histories; these commands deliberately do not use them. A main-only copy works. Existing branches/tags are preserved. An identical snapshot on main skips Git/PR writes but `checkpoint1` still prepares missing issues. If issue preparation fails, keep successful issues, fix the reported error and rerun `./checkpoint1`; it rechecks all pages/states before creating missing items, including after an uncertain response. Preserve the body marker or title key for reuse in other clones; local receipts in Git metadata additionally preserve identities after edits. Missing recorded issues, duplicate identities and invalid receipts stop rather than creating replacements. Do not run imports concurrently, even from different clones.

Keep the printed stash SHA; return to the original branch and use the printed `git stash apply --index` command when safe. Ignored files are not stashed; collisions stop the import. Later push/PR failures retain issues and recoverable work and print retry instructions. Check for an existing remote branch/PR before retrying those steps; do not recreate the issues.

メンテナー用テスト / Maintainer tests: `node --test tests/checkpoint.test.mjs` (isolated local repositories, fake GitHub CLI, no live issues or PRs).

## コンテンツに含まれる要素

`src/content/playbook/` の Markdown には以下が含まれます。サイト構築時にレンダリング対応が必要です：

- **Mermaid 図** （` ```mermaid ` ブロック）：アーキテクチャ図やフローを表現
- **コードブロック**：シンタックスハイライト推奨
- **テーブル、リスト、見出し**：標準的な Markdown 要素

> 💡 サイト構築のプロンプトで「Mermaid 図をレンダリングできるようにする」と明示すると確実です。

## Copilot Chat セクションで試すこと

まずは presentation mode ではなく、**playbook landing page** を作るところから始めます。

- `src/content/playbook/ja/` の Markdown を読み込んでカード一覧を表示
- `src/lib/playbook-categories.ts` から category metadata（label / actor / avatar / description / color）を使う
- `public/planet-*.webp`、`public/icons/`、Octocat 画像、背景画像を使ってカテゴリごとの見た目を作る
- その後のステップで詳細ページや presentation mode に拡張する
