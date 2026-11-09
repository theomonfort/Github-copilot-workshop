# GitHub Copilot Workshop

ハンズオン教材の復帰用チェックポイント。`main` は content / assets から始めるスターターのままです。変更前の状態は release **1.0** (`v1.0.0`) に保存しています。

## このブランチ: checkpoint/02-cloud-agent

PLAN のハーネスと、日本語 Playbook の基本サイトを含みます。

- `.github/copilot-instructions.md` と `.github/instructions/frontend.instructions.md`: Astro / Tailwind / TypeScript / npm、レトロ JRPG テーマの規約
- `.mcp.json`: Workspace の GitHub MCP と Context7 の接続先 (`mcpServers`)
- `.vscode/settings.json`: Workspace ルートの MCP 設定を有効化
- `.agents/skills/`: `github-issues` と `hands-on-helper` (参照ファイル / ライセンスを同梱)
- `/playbook/`: カテゴリ別カード、SDLC ナビゲーション、惑星 / アバター / カテゴリメタデータ
- `/playbook/<slug>/`: 日本語 Markdown 全文、リンク集、前後のページ、「Playbook に戻る」

**01-develop** の基本サイトに、Cloud Agent の課題に対応するプレゼン機能を追加しています。英語 Markdown は保持しますが、サイトは日本語のみです。

- 一覧カードの「プレゼンモード」または詳細のボタン / `P` で開始 (`?present=1`)。一覧と通常の Markdown 詳細は引き続き利用できます。
- `##` ごとのスライド、タイトル / 「一言で」のヒーロー、カテゴリ別 Octocat と背景、frontmatter のグループ別リンク集
- `←` / `→` / Space、画面上の前後ボタン、クリック可能な進捗バー。デッキ端から隣のエントリへ移動できます。
- `?present=1&slide=3` のような深いリンク、カテゴリ別 TOC、現在地表示と TOC スクロール位置の維持、`T` で TOC 切替、`Esc` で一覧へ
- Mermaid 図の描画 (後続スライドを含む)、スクロール可能なコード / テーブル
- 幅 768px 未満では通常の Markdown 詳細に戻るモバイルフォールバック

E2E / PR テストは **03-tests** で追加します。TOC のデザイン案 10 種、CLI 用の追加機能、元サイトの英語切替 / BGM は含めません。

## 起動

Node.js **22.12 以上**と npm を使います。Codespaces は同梱の Dev Container を利用できます。

```bash
npm ci
npm run dev
```

`http://localhost:4321/playbook/` を開きます。Codespaces ではポート 4321 の転送 URL を使います。

```bash
npm run check
npm run build
npm run preview
```

preview はポート **4322**。サイトはドメイン直下 (`base: /`) 用です。元サイトの `/theomonfort` サブパスや pnpm は不要です。

## Workspace MCP

現在の VS Code で **Session Target → Copilot** を選び、**Customizations → MCP Servers → Workspace** を開きます。`.vscode/settings.json` で `chat.mcp.workspaceRootConfig.enabled` を有効にしています。対応する VS Code / Copilot のバージョンが必要です。Codespaces でもこの Workspace 設定を使います。

GitHub MCP (`github-mcp-server`, `https://api.githubcopilot.com/mcp/`) と Context7 (`context7`, `https://mcp.context7.com/mcp`) は登録済みです。同じサーバーを追加し直さず、未登録のサーバーを追加する場合だけ **Workspace の + → HTTP** を選び、URL とサーバー名を入力します。保存先はリポジトリルートの **`.mcp.json`** (`mcpServers`) です。**User / Global** は選びません。

この手順は **Copilot ハーネス**用です。従来の **Local ハーネス**用 `.vscode/mcp.json` (`servers`) とは形式が異なります。この教材では併用せず、同じサーバーの二重登録を避けます。[VS Code の設定先の説明](https://code.visualstudio.com/docs/agent-customization/mcp-servers#_choose-a-configuration-destination)を参照してください。

## チェックポイントから PR を作る / Create a checkpoint PR

**未保存のエディタ内容を保存してから、自分のリポジトリで 1 つ選んで実行します。** Node.js 22.12 以上、Git 2.23 以上、GitHub CLI (`gh`) とサインイン、`origin` への push 権限が必要です。`origin` は自分の GitHub リポジトリを指す HTTPS / SSH URL にしてください。

| コマンド / Command | 再開地点 / Snapshot |
|---|---|
| `./checkpoint1` | 基本サイト + 開発課題の Issue / `checkpoint/01-develop` |
| `./checkpoint2` | プレゼン機能 / `checkpoint/02-cloud-agent` |
| `./checkpoint3` | E2E / PR テスト / `checkpoint/03-tests` |

**解析教材 / Analysis exercises:** checkpoint 1 / 2 / 3 には、意図的なセキュリティ問題と品質問題が各 1 / 2 / 3 件、アプリから隔離して含まれます。製品に出荷せず、import / 実行しないでください。Snapshots include cumulative, intentionally flawed static-analysis exercises, not application code. The proof workflow runs only in the canonical template; participant repositories keep their existing CodeQL setup.

**`checkpoint1` のみ:** 事前確認後、stash や checkout の変更前に、自分のリポジトリへ [Part 6 と共通の日本語 Issue 8 件](scripts/checkpoint-issues.json)を準備します。Issues の有効化と `gh` の Issue 読み取り / 作成権限が必要です。既存の open / closed Issue は再利用し、編集内容や状態を変えません。実際の番号と URL を表示するため、Issue 番号を 1 からと仮定しないでください。`checkpoint2` / `checkpoint3` は Issue を作りません。

課題はプレゼンの基本 / 本文 / Mermaid / レスポンシブ (Cloud Agent、checkpoint2)、テスト / CI (Part 11、checkpoint3)、既存 3D ギャラクシーの再現と音声 (Part 13)、日次レポート (Part 14) です。基本サイトは checkpoint1 に含まれるため重複課題にしません。3D / 音声 / 日次レポートは checkpoint1〜3 には含まれず、音声は 3D のマージ後に進めます。Issue 作成だけでは実装・自動割り当て・完了処理はしません。

各コマンドは変更済み・未追跡ファイルを必要に応じて名前付き stash に保存し、取得した **自分の `origin/main`** から新しい `workshop-checkpointN` ブランチを作ります。使用済みの名前には `-2` などを付け、既存ブランチは変更しません。

**公式教材 `theomonfort/Github-copilot-workshop` の現在の named checkpoint** を読み取り専用で fetch し、**ファイルの tree だけ**を作業ブランチへ取り込みます。commit → 自分の `origin` へ新規ブランチだけ push → `main` 宛ての PR 作成まで実行し、**merge はしません**。追跡ファイルを checkpoint の tree で置き換えるため、PR の削除差分も確認してください。同じ snapshot が既に `origin/main` にある場合、stash / ブランチ / commit / push / PR は作りませんが、`checkpoint1` は不足する Issue を準備します。

テンプレートからコピーされたブランチは履歴が独立しているため、PR 用に直接 switch / merge しません。**Include all branches は不要**で、`main` だけコピーした repo でも使えます。公式教材自身を `origin` にしての実行は拒否します。

### 保存した作業とエラーからの復帰 / Recovery

Issue の準備に失敗した場合、成功済みの Issue は残し、表示された権限・設定・通信エラーを解消して `./checkpoint1` を再実行してください。checkout の変更前に停止し、再実行時は全状態・全ページから既存 Issue を確認して不足分だけ作成します。応答が失われた場合も、手動で重複作成しないでください。リポジトリ設定は自動変更しません。

本文の `<!-- workshop-issue:KEY -->` またはタイトルの `[playbook:KEY]` を残してください。Git の共通メタデータ内 `workshop-issues/` に番号のローカル記録も保存し、同じ clone での編集後の再実行に使います (commit / stash 対象外)。別 clone ではマーカーが必要です。記録済み Issue の削除 / 移動、重複キー、破損した記録は自動修復せず停止します。古い `.lock` は記載されたプロセスの終了を確認してから削除してください。同じリポジトリへ別 clone からも同時実行しないでください。

stash は自動で戻しません。表示された **stash SHA** と復帰コマンドを保存し、元のブランチへ戻って `git stash apply --index` で復元します。内容を確認するまで stash を削除しないでください。ignored ファイルは stash に含まれず、置き換えに衝突する場合は事前に停止します。

push / PR 作成に失敗しても、自動 reset やブランチ削除はしません。表示された成功済みステップ、commit、再試行コマンドを確認してください。リモートブランチ / PR が既に作られていないか確認してから再試行し、既存ブランチを上書きしないでください。同じ checkout で複数のコマンドを同時実行しないでください。

**English:** Save editor buffers, then run one command above in your own repository (or invoke it by path from another directory). Requires Node.js 22.12+, Git 2.23+, authenticated `gh`, and push access. It saves tracked/untracked edits in a named stash, creates a fresh branch from your current remote `main`, imports only the current canonical checkpoint's files, commits, pushes that new branch, and opens a PR against your `main`. Review the PR, including deletions, and merge it yourself when ready.

Only `checkpoint1` also prepares the eight Japanese build-step issues from the current canonical catalogue, before stashing or changing the checkout. It requires Issues enabled and read/create access, reuses open/closed issues without editing or reopening them, and prints their actual numbers/URLs. Presentation work maps to checkpoint2, tests/CI to checkpoint3; 3D, its dependent audio work, and daily reporting are later extensions, not snapshot features. No implementation or assignment is triggered. `checkpoint2` and `checkpoint3` never seed issues.

Copied template branches have unrelated histories; these commands deliberately do not use them. A main-only copy works. Existing branches/tags are preserved. An identical snapshot on main skips Git/PR writes but `checkpoint1` still prepares missing issues. If issue preparation fails, keep successful issues, fix the reported error and rerun `./checkpoint1`; it rechecks all pages/states before creating missing items, including after an uncertain response. Preserve the body marker or title key for reuse in other clones; local receipts in Git metadata additionally preserve identities after edits. Missing recorded issues, duplicate identities and invalid receipts stop rather than creating replacements. Do not run imports concurrently, even from different clones.

Keep the printed stash SHA; return to the original branch and use the printed `git stash apply --index` command when safe. Ignored files are not stashed; collisions stop the import. Later push/PR failures retain issues and recoverable work and print retry instructions. Check for an existing remote branch/PR before retrying those steps; do not recreate the issues.

メンテナー用テスト / Maintainer tests: `node --test tests/checkpoint.test.mjs` (isolated local repositories, fake GitHub CLI, no live issues or PRs).

## 意図的な解析演習 / Intentional analysis exercises

`workshop-exercises/` に、各 checkpoint で新しいセキュリティ問題 1 件と品質問題 1 件を追加します (累積 1 / 2 / 3 件ずつ)。**製品用コードではなく、通常アプリから import / 実行しません。** [講師用マップ、修正方法、実際の検出の見方](workshop-exercises/README.md)を確認してください。

**English:** Each checkpoint adds one inert security example and one quality example outside the application. The proof workflow runs only in the canonical template, separating actual CodeQL security alerts from quality-rule artifacts. It is skipped in participant copies to preserve existing default setup. GitHub Code Quality requires separate enablement and licensing; this template does not enable it. Required checks and security policies still apply. Later imports restore canonical examples, including any you previously fixed.

## 手動の前提条件

- VS Code と GitHub Copilot にサインインし、対象リポジトリへの権限を確認してください。
- MCP サーバーの信頼確認 / 起動 / OAuth 認証は各自で実施します。接続先 JSON だけで認証済みにはなりません。Context7 の利用条件 / 制限も確認し、トークンや API キーをコミットしないでください。
- Skill を読み込むため、新しい Copilot Chat を開いてください。認識しない版ではウィンドウを再読み込みし、必要なら `.agents/skills/` を `.github/skills/` に移動します。
- Cloud Agent の MCP 設定は VS Code とは別です。リポジトリの Settings > Copilot > MCP servers で設定してください。
- Copilot Code Review、CodeQL、Secret Scanning、Cloud Agent の有効化などのアカウント / リポジトリ設定は、このブランチには保存されません。
- 外部ドキュメント、MCP、Google Fonts にはネットワーク接続が必要です。フォント未取得時は fallback フォントで表示します。

どの checkpoint も前段の内容を含みます。Cloud Agent の機能を揃えてから TEST & SECURE のテストへ進みます。

## 再利用元

- サイト / PLAN 手順: [theomonfort/theomonfort](https://github.com/theomonfort/theomonfort/tree/bd8b98d4f00060979e782e95d60ea74709b54da4), commit `bd8b98d4f00060979e782e95d60ea74709b54da4`。Playbook のカード / 詳細 / スタイルを抽出し、日本語・npm・ルートパス用に調整。ホームのゲーム、BGM、装備所、英語 UI は含めません。
- Skills: [theomonfort/skills](https://github.com/theomonfort/skills/tree/a8f7e7c092d3ed3e45860d416aec32fb115a4e21), commit `a8f7e7c092d3ed3e45860d416aec32fb115a4e21`。MIT ライセンスは `.agents/skills/LICENSE`。helper の案内はこの checkpoint 順序に合わせて調整しています。
- スターター: `v1.0.0`, commit `8145d5464c0265e1724807bb2cf1cca5f609640d`。
