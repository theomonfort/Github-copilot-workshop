# GitHub Copilot Workshop

ハンズオン教材の復帰用チェックポイント。`main` は content / assets から始めるスターターのままです。変更前の状態は release **1.0** (`v1.0.0`) に保存しています。

## このブランチ: checkpoint/03-tests

PLAN のハーネスと、日本語 Playbook の基本サイトを含みます。

- `.github/copilot-instructions.md` と `.github/instructions/frontend.instructions.md`: Astro / Tailwind / TypeScript / npm、レトロ JRPG テーマの規約
- `.mcp.json`: Workspace の Context7、Playwright Test MCP の接続先 (`mcpServers`)
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

**02-cloud-agent** に、元サイトの 3D ギャラクシー、読み取り専用 Zettelkasten、Playwright E2E と `.github/workflows/test.yml` を追加しています。2D の一覧 / 詳細とプレゼンはそのまま利用できます。TOC のデザイン案 10 種、元サイトの英語切替 / BGM / 環境音は含めません。

## Zettelkasten / 英語のプレゼン目次

プレゼン中に **Zettelkasten** ボタンまたは `Z` で、記事・スライドに対応するノートを開きます。グラフ、検索、関連ノートへの移動、7分野の切替に対応します。`Esc` は検索候補を先に閉じ、次の `Esc` で元のスライドへ戻ります。TOC のカテゴリと記事名は既存の `labelEn` / `titleEn` を使い、日本語本文・記事URL・通常一覧は変えません。

ノートは `src/content/zettelkasten/` の公開教材だけを静的 JSON として配信します。編集・作成・削除UI、書き込みAPI、localStorageへの保存はありません。個人のvaultやサーバー側の書き込み処理は含めません。

ビューアーとノートの出典は [theomonfort/theomonfort の固定版](https://github.com/theomonfort/theomonfort/tree/c28b27037dbf92b23f15bdeea27cc6449e5e29c6) です。`src/vendor/zettelkasten/` の既存 JS / CSS は変更せず同梱する限定的な互換性例外とし、新しい接続処理は TypeScript で記述しています。出典・第三者ライセンスは同ディレクトリの `NOTICE` / `LICENSE-*` を参照してください。

## 3D ギャラクシー

`/playbook/` の **3D** ボタン、または `/playbook/?view=3d` から開きます。元サイトと同じ Three.js の立体モデル、中央の SDLC 太陽、5 惑星、Introduction の出発ステーション、Administration の母艦、記事の衛星と移動する小型船を使います。新しい別デザインや画像の疑似 3D ではありません。

惑星から衛星 / ミッションを選ぶと概要と通常の記事リンクを表示します。ドラッグ回転、スクロールでズーム、右ドラッグでパン、カメラボタン、全体図への復帰に対応します。`?view=3d&sector=plan` は目的地の深いリンクです。キーボード操作、Esc、動きの停止、reduced-motion、モバイル表示を維持しています。

描画は 3D を開いたときだけ読み込み、2D への復帰やページ移動時に終了します。対応する WebGL 2 ブラウザが必要です。初期化失敗 / コンテキスト喪失時はエラーを表示して 2D に戻り、JavaScript なしでも基本カタログを利用できます。**音声は含めず、3D / 音声の初期 Issue も作成しません。** 既存 Issue の状態は自動で変更しません。

## E2E / PR テスト

```bash
npm ci
npm run check
npm run test:e2e
```

更新済み Dev Container では Chromium の手動導入は不要です。コンテナ外のみ `npx playwright install --with-deps chromium` を実行してください。

テストは production build を作り、専用ポート **44321** で preview を起動・終了します。既存のサーバーは再利用しません。ポートが使用中なら先に競合を解消してください。

`tests/e2e/presentation.spec.ts` は、通常の一覧 / 詳細を入口として、スライドの前後移動、英語 TOC とスクロール位置、Zettelkasten の開閉・検索・読み取り専用動作、深いリンク、進捗バー、リンク集、後続 Mermaid スライド、Esc、モバイルフォールバック、全詳細のローカルリンク / 画像を検証します。外部フォントへの通信はテスト中だけ差し替えます。

`tests/e2e/galaxy.spec.ts` は、実際の WebGL 描画と色付きピクセル、目的地 / 衛星 / 記事への移動、URL 復元、カメラ操作、モバイル、動きの停止、失敗時の 2D 復帰、遅延読込の中断と描画終了を検証します。CI でも GPU に依存せず検証できるよう、テスト用 Chromium にだけ SwiftShader を指定します。アプリのブラウザ設定は変更しません。

PR の作成 / 更新時に GitHub Actions が Node.js 22、`npm ci`、Chromium、型チェック、E2E を実行します。失敗時は HTML レポート / trace / スクリーンショットを artifact に保存します。Actions の実行許可、外部 PR の承認、必須チェックの branch protection は各自のリポジトリで設定してください。Security のアカウント設定はこの checkpoint に含まれません。

### Copilot にテストを生成してもらう

checkpoint3 には Playwright 1.58.2 公式ベースの `playwright-test-planner` / `playwright-test-generator` / `playwright-test-healer` を `.github/agents/` に同梱しています。planner で候補を相談し、合意したケースを generator で `tests/e2e/` に追加します。healer は失敗調査時のみ任意で使います。`.github/copilot-instructions.md` にも、機能とユーザーが選んだテストを一緒に実装する指示を追加済みです。

依存導入後、新しい Copilot セッションで Workspace の `playwright-test` MCP を信頼・起動してください。ルート `.mcp.json` は一時 Node 22.23.4 とプロジェクト内の Playwright を `--headless` で使い、GUI のない Codespaces にも対応します（初回は Node の取得が必要）。`.vscode/mcp.json` の追加や initializer の再実行は不要です。seed が未作成なら planner の初回 setup で自動的に `tests/e2e/seed.spec.ts` が作られます。計画は `specs/`、通常テストは `tests/e2e/` に置き、実演専用の `tests/demo/` は分離したままにします。

公式定義の出典は [Playwright v1.58.2](https://github.com/microsoft/playwright/tree/ce480a952553175eae75342aad2c5e86cdf2cbba/packages/playwright/src/agents) です。モデル固定とエージェント内の重複MCP設定を省き、既存パスと合意フローに合わせています。healer は失敗を隠す skip / fixme を自動追加しません。ライセンスと通知は `.github/agents/PLAYWRIGHT-LICENSE` / `PLAYWRIGHT-NOTICE` に同梱しています。

## 18秒のライブデモ / Live demo

上記の依存関係と Chromium の準備後、リポジトリのルートで実行します。

```bash
npx --package=node@22.23.4 node ./node_modules/@playwright/test/cli.js test --config=playwright.demo.config.ts
```

1つのブラウザ・ページで、一覧 → ギットハブの記事 → `P` でプレゼン → 次のスライド → 目次から Copilot → Fusion → `Esc` で一覧へ、という操作を自動で見せます。Inspector の手動ステップやトレース再生ではありません。一覧が表示されてから約18秒、実測15〜20秒を確認します。初回の一時 Node 取得、ビルド、ブラウザ起動は別時間です。遅い環境で20秒を超える場合はデモの時間チェックが失敗します。

専用ポート **44331** を使い、終了時に専用ブラウザと preview を閉じます。出力先は `test-results/demo` に分離し、通常テストの結果を削除しません。既存サーバーは再利用・停止しません。ポートが使用中なら起動を中止します。GUI があるローカル環境向けで、ヘッドレスの Codespace ではそのまま画面表示できません。

`tests/demo/playbook.demo.ts` は専用設定でだけ検出され、通常の `npx playwright test` / PR CI の対象には入りません。見せるための待機はこのデモだけです。3D、動画、外部フォント取得、トレース保存は含めません。Node 26 と Playwright 1.58.2 のトレース保存問題を避けるため、一時 Node 22 を明示しています。外側に `npx -c` を付けないでください。内側の preview 起動と衝突します。

既存の派生リポジトリには自動反映されません。checkpoint3 を取り込み済みなら、新規の `playwright.demo.config.ts` と `tests/demo/playbook.demo.ts` だけを追加すれば使えます。同名ファイルがある場合は上書きせず差分を確認してください。デモのために `./checkpoint3` で全体を再取り込みする必要はありません。

**English:** This opt-in, headed demo uses one page/context and runs automatically for about 18 seconds after the catalogue is visible. Package download, build and browser startup are additional. It checks real navigation and slide state, and fails if the measured visible journey exceeds 20 seconds. Normal tests and PR CI remain unchanged. Demo output stays in `test-results/demo` without deleting normal test results. It uses its own port (44331), closes its browser/server, requires a desktop GUI, and uses temporary Node 22 without `npx -c`. Existing template copies need only the two new demo files, added without overwriting local work.

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

## Playbook 教材の同期 / Playbook content source

日本語・英語各39記事は [theomonfort/theomonfort の固定版](https://github.com/theomonfort/theomonfort/tree/817360dde8a93a4cea4d6b60db578b6ea899c345) (`817360dde8a93a4cea4d6b60db578b6ea899c345`) から同期しています。本文の出典は保持し、配置パス・レトロ配色・デモ手順の折りたたみ・標準動画プレーヤーだけをワークショップ用に調整しています。参照画像・動画・ダウンロード資料のみを追加し、サイト全体の `public/` 同期は行っていません。

main は素材のみ、checkpoint1 は基本サイト、checkpoint2 はプレゼン、checkpoint3 は既存3Dとテスト、という構成は変わりません。本文図表用のCSSだけを checkpoint1 以降で再利用し、モダンテーマ・新ナビ・音声は取り込みません。英語は引き続き教材素材で、画面は日本語です。元サイトの archived 記事 (Hooks / Usage-Based Billing / VS Code Agents Window) も削除せず保持しています。ローカルにないハンズオン・Changelog・英語ページへの本文リンクは元サイトを開きます。

**English:** JA/EN content (39 entries each) is pinned to the revision above. Citations are retained; only standalone paths, retro colors, native demo disclosures and video controls are adapted. Only referenced media/downloads and scoped article styles are reused, not the modern theme, navigation, audio or broad public-asset mirror. Main stays starter-only and checkpoint feature boundaries are unchanged. English remains source material rather than a new UI. Source-archived articles remain available; links to routes absent here open the source website.

## ブラウザテストの準備 / Browser test tooling

Dev Container は Playwright CLI 1.58.2 と対応する Chromium・Linux依存関係を作成時に準備します。プロジェクトの依存・設定が未作成なら、Copilot に「既存構成を確認し、`@playwright/test@1.58.2` と必要なテスト設定を追加して」と依頼してください。古いコピーは設定の取り込みとコンテナのリビルドが必要です。

**English:** The Dev Container provisions Playwright CLI 1.58.2, matching Chromium and Linux dependencies. Project setup is separate: ask Copilot to inspect the project and add `@playwright/test@1.58.2` and test configuration if missing. Existing copies need the updated container configuration and a rebuild.

## Linux sandbox の依存関係 / Linux sandbox dependencies

Dev Container はイメージのビルド時に `bubblewrap` (`bwrap`)、`socat`、ネットワーク接続用の `slirp4netns` を導入し、各バイナリのバージョン表示を確認します。導入・確認の失敗はビルドを停止します。これらの依存は、ツールの接続や Playwright のセットアップより前に用意されます。既存の派生リポジトリには自動反映されないため、`.devcontainer/devcontainer.json` と `.devcontainer/Dockerfile` の両方を更新し、作業を保存して Codespace をリビルドしてください。sandbox 設定や保護ポリシーは変更しません。実際の sandbox 動作は Codespace 内で確認が必要です。

**English:** The Dev Container installs `bubblewrap` (`bwrap`), `socat` and `slirp4netns` during the image build and checks that their version commands succeed. Installation or verification failures stop the build. These dependencies are ready before tools connect or Playwright setup starts. Existing copies need both `.devcontainer/devcontainer.json` and `.devcontainer/Dockerfile` updated: save your work and rebuild the Codespace. Sandbox settings and protections remain unchanged; actual sandbox operation still needs verification inside the Codespace.

## Copilot アプリから Codespace に接続 / Connect from the Copilot app

`.devcontainer/devcontainer.json` に `ghcr.io/github/copilot-host/copilotd:0` を追加済みです。コンテナ起動時にホスト `copilotd` を起動し、Codespace を自動登録します。既存のイメージ、開発ツール、拡張機能、ポート、作成時コマンドは維持しています。Actions 用の `copilot-setup-steps.yml` とは別の設定です。

1. **Copilot ライセンス、カスタム環境へのアクセス、Codespaces の利用権限**が必要です。このテンプレートから新しいリポジトリを作成し、設定を含むブランチで Codespace を作成します。
2. 既存の派生リポジトリは自動更新されません。設定を取り込み、既存 Codespace の作業を保存してコンテナをリビルドしてください。main と `checkpoint1` / `checkpoint2` / `checkpoint3` の全スナップショットに同じ feature があり、チェックポイントの取り込みで削除されません。
3. コンテナ起動と**ホスト登録の完了**を待ちます。JSON を追加しただけでは接続できません。Copilot アプリで Codespace 所有者と同じ GitHub アカウントにサインインし、**Environments** から Codespace を選択します。アプリの認証トークンには `codespace` スコープが必要です。

**English:** Requires a Copilot license, access to custom environments, and Codespaces access. New template repositories inherit the host feature; existing generated repositories do not update automatically. Create a Codespace on the branch containing the committed/pushed configuration, or save your work, update the configuration and rebuild an existing Codespace. All three checkpoint snapshots retain the feature. Wait for startup and host registration, then sign in to the Copilot app as the Codespace owner using a client token with the `codespace` scope. Open **Environments** and select the registered Codespace. Adding JSON alone does not register a running environment.

GitHub CLI を使う場合 / Optional commands (authenticated `gh` required):

```bash
gh codespace create -r OWNER/REPOSITORY -b BRANCH
```

または、更新した既存環境をリビルド / Or rebuild an existing Codespace after updating its configuration:

```bash
gh codespace rebuild -c CODESPACE-NAME
```

登録済みの停止中 Codespace を選ぶと、自動で起動して `copilotd` を開始します。表示されない場合は権限、アカウント、設定の反映と登録を確認し、Codespace 内のログを確認してください。**アプリを閉じても Codespace は停止しません。** 利用後は Codespaces 側で停止し、コンピューティングの課金を管理してください。

Selecting a registered, stopped Codespace wakes it and starts `copilotd`. If it is missing, check access, account, applied configuration and registration, then inspect the host log **inside the Codespace**. Closing the app does not stop billed compute; stop the Codespace when finished.

```bash
tail -F /workspaces/.copilotd/logs/copilotd.log
```

公式手順 / Source: [Creating a custom environment for agents](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-a-custom-environment)

## Workspace MCP

現在の VS Code で **Session Target → Copilot** を選び、**Customizations → MCP Servers** を開きます。`.vscode/settings.json` で `chat.mcp.workspaceRootConfig.enabled` を有効にしています。対応する VS Code / Copilot のバージョンが必要です。Codespaces でもこの Workspace 設定を使います。

GitHub MCP (`github-mcp-server`) は **Built-in** のものを使い、Workspace に重複登録しません。Context7 (`context7`, `https://mcp.context7.com/mcp`) は Workspace に登録済みです。未登録の外部サーバーを追加する場合だけ **Workspace の + → HTTP** を選び、URL とサーバー名を入力します。保存先はリポジトリルートの **`.mcp.json`** (`mcpServers`) です。**User / Global** は選びません。

この手順は **Copilot ハーネス**用です。従来の **Local ハーネス**用 `.vscode/mcp.json` (`servers`) とは形式が異なります。この教材では併用せず、同じサーバーの二重登録を避けます。[VS Code の設定先の説明](https://code.visualstudio.com/docs/agent-customization/mcp-servers#_choose-a-configuration-destination)を参照してください。

## チェックポイントから PR を作る / Create a checkpoint PR

**未保存のエディタ内容を保存してから、自分のリポジトリで 1 つ選んで実行します。** Node.js 22.12 以上、Git 2.23 以上、GitHub CLI (`gh`) とサインイン、`origin` への push 権限が必要です。`origin` は自分の GitHub リポジトリを指す HTTPS / SSH URL にしてください。

| コマンド / Command | 再開地点 / Snapshot |
|---|---|
| `./checkpoint1` | 基本サイト + 開発課題の Issue / `checkpoint/01-develop` |
| `./checkpoint2` | プレゼン機能 / `checkpoint/02-cloud-agent` |
| `./checkpoint3` | 3D ギャラクシー + E2E / PR テスト / `checkpoint/03-tests` |

**`checkpoint1` のみ:** 事前確認後、stash や checkout の変更前に、自分のリポジトリへ [Part 6 と共通の日本語 Issue 6 件](scripts/checkpoint-issues.json)を準備します。Issues の有効化と `gh` の Issue 読み取り / 作成権限が必要です。既存の open / closed Issue は再利用し、編集内容や状態を変えません。実際の番号と URL を表示するため、Issue 番号を 1 からと仮定しないでください。`checkpoint2` / `checkpoint3` は Issue を作りません。

課題はプレゼンの基本 / 本文 / Mermaid / レスポンシブ (任意の Cloud Agent、Part 8 / checkpoint2)、テスト / CI (Part 9)、日次レポート (Operate、Part 13) の6件です。基本サイトは checkpoint1 に含まれるため重複課題にしません。初期 Issue から `playbook-3d` / `galaxy-audio` を外し、Zettelkasten も Issue 化しません。CLI の演習はありません。**checkpoint3 はテスト / CI、3D、読み取り専用 Zettelkasten、英語目次を含む完成版のままです。** 音声 / 日次 workflow は snapshot に含まれません。以前作成した Issue の本文や状態、作業キーの記録は保持し、自動割り当て・完了処理もしません。

各コマンドは変更済み・未追跡ファイルを必要に応じて名前付き stash に保存し、取得した **自分の `origin/main`** から新しい `workshop-checkpointN` ブランチを作ります。使用済みの名前には `-2` などを付け、既存ブランチは変更しません。

**公式教材 `theomonfort/Github-copilot-workshop` の現在の named checkpoint** を読み取り専用で fetch し、**ファイルの tree だけ**を作業ブランチへ取り込みます。commit → 自分の `origin` へ新規ブランチだけ push → `main` 宛ての PR 作成まで実行し、**merge はしません**。追跡ファイルを checkpoint の tree で置き換えるため、PR の削除差分も確認してください。同じ snapshot が既に `origin/main` にある場合、stash / ブランチ / commit / push / PR は作りませんが、`checkpoint1` は不足する Issue を準備します。

PR 作成後、取り込んだ `package-lock.json` で **`npm ci` を自動実行**します（`node_modules` は再作成）。成功後は `npm run dev` で開始できます。既に取り込み済みでも、現在の checkout が同じ snapshot で変更がなければ導入します。異なる snapshot や変更がある場合は作業を残して停止します。導入失敗はエラー終了し、取り込み・PR は残します。原因を解消して同じ checkout で `npm ci` だけを再試行してください。テスト・ビルドは自動実行しません。

テンプレートからコピーされたブランチは履歴が独立しているため、PR 用に直接 switch / merge しません。**Include all branches は不要**で、`main` だけコピーした repo でも使えます。公式教材自身を `origin` にしての実行は拒否します。

### 保存した作業とエラーからの復帰 / Recovery

Issue の準備に失敗した場合、成功済みの Issue は残し、表示された権限・設定・通信エラーを解消して `./checkpoint1` を再実行してください。checkout の変更前に停止し、再実行時は全状態・全ページから既存 Issue を確認して不足分だけ作成します。応答が失われた場合も、手動で重複作成しないでください。リポジトリ設定は自動変更しません。

本文の `<!-- workshop-issue:KEY -->` またはタイトルの `[playbook:KEY]` を残してください。Git の共通メタデータ内 `workshop-issues/` に番号のローカル記録も保存し、同じ clone での編集後の再実行に使います (commit / stash 対象外)。別 clone ではマーカーが必要です。記録済み Issue の削除 / 移動、重複キー、破損した記録は自動修復せず停止します。古い `.lock` は記載されたプロセスの終了を確認してから削除してください。同じリポジトリへ別 clone からも同時実行しないでください。

stash は自動で戻しません。表示された **stash SHA** と復帰コマンドを保存し、元のブランチへ戻って `git stash apply --index` で復元します。内容を確認するまで stash を削除しないでください。ignored ファイルは stash に含まれず、置き換えに衝突する場合は事前に停止します。

checkpoint の stash で `.gitignore` が退避・復元されても、直前から ignored だったファイルは残したまま取り込みます。途中で増えた未追跡ファイルや追跡ファイルの変更は停止対象です。旧版で stash 後に停止し `package.json` が見えなくなった場合、繰り返し実行せず `git stash list` と `git stash show --include-untracked <SHA>` で保存先を確認してください。複数回試した場合、元のサイトは最新ではなく最初の stash に残っていることがあります。

push / PR 作成に失敗しても、自動 reset やブランチ削除はしません。表示された成功済みステップ、commit、再試行コマンドを確認してください。リモートブランチ / PR が既に作られていないか確認してから再試行し、既存ブランチを上書きしないでください。同じ checkout で複数のコマンドを同時実行しないでください。

**English:** Save editor buffers, then run one command above in your own repository (or invoke it by path from another directory). Requires Node.js 22.12+, Git 2.23+, authenticated `gh`, and push access. It saves tracked/untracked edits in a named stash, creates a fresh branch from your current remote `main`, imports only the current canonical checkpoint's files, commits, pushes that new branch, and opens a PR against your `main`. Review the PR, including deletions, and merge it yourself when ready.

After PR creation, it runs `npm ci` using the imported lockfile, recreating `node_modules`. An already-imported snapshot also installs dependencies only when the current checkout matches and has no changes. Otherwise it stops without touching your work. Installation failure exits nonzero and keeps the import and PR; fix the error and retry only `npm ci` in the same checkout. Tests/builds are not run automatically.

Only `checkpoint1` also prepares the six Japanese build-step issues from the current canonical catalogue, before stashing or changing the checkout. It requires Issues enabled and read/create access, reuses open/closed issues without editing or reopening them, and prints their actual numbers/URLs. Presentation work maps to optional Cloud Agent (Part 8) or checkpoint2, tests/CI to Part 9, and daily reporting to Operate (Part 13). 3D, audio and Zettelkasten are not initial issue tasks; there is no CLI exercise. Checkpoint3 remains the complete snapshot with tests/CI, 3D, read-only Zettelkasten and English TOC. Audio and the daily workflow are not bundled. Previously created issues and identity receipts are preserved; no automatic assignment or completion is triggered. `checkpoint2` and `checkpoint3` never seed issues.

Copied template branches have unrelated histories; these commands deliberately do not use them. A main-only copy works. Existing branches/tags are preserved. An identical snapshot on main skips Git/PR writes but `checkpoint1` still prepares missing issues. If issue preparation fails, keep successful issues, fix the reported error and rerun `./checkpoint1`; it rechecks all pages/states before creating missing items, including after an uncertain response. Preserve the body marker or title key for reuse in other clones; local receipts in Git metadata additionally preserve identities after edits. Missing recorded issues, duplicate identities and invalid receipts stop rather than creating replacements. Do not run imports concurrently, even from different clones.

Keep the printed stash SHA; return to the original branch and use the printed `git stash apply --index` command when safe. Ignored files are not stashed; collisions stop the import. Later push/PR failures retain issues and recoverable work and print retry instructions. Check for an existing remote branch/PR before retrying those steps; do not recreate the issues.

Checkpoint imports retain files that were already ignored immediately before stashing, even if stashing changes `.gitignore`. New untracked files or tracked changes still stop the import. If an older helper stopped after stashing and `package.json` disappeared, do not repeatedly retry: inspect `git stash list` and `git stash show --include-untracked <SHA>`. After multiple attempts, the original site may be in the first stash, not the latest.

メンテナー用テスト / Maintainer tests: `node --test tests/checkpoint.test.mjs` (isolated local repositories, fake GitHub CLI, no live issues or PRs).

## 最初からやり直す / Reset the workshop

自分のリポジトリで、エディタの未保存内容を保存してから `./reset` を実行します。checkpoint と同じ Node / Git / `gh` の前提に加え、対象 Issue / PR を閉じる権限とブランチ削除権限が必要です。公式テンプレート自体では実行できません。

最初に実際の対象リポジトリ、starter の SHA、閉じる Issue / PR の番号と URL、削除するリモートブランチと SHA、保持する対象を表示します。表示された `RESET github.com/OWNER/REPOSITORY` を完全一致で入力した場合だけ続行します。確認を省略するオプションはありません。取消時は fetch による Git メタデータ取得以外、checkout / remote を変更しません。

- 現在の公式 `main` の**全追跡ファイル**から、新しい参加者ブランチと starter 復帰 PR を作成します。履歴は書き換えず、**参加者 main が戻るのは PR を確認・マージした後**です。サイトやテストの削除差分も確認してください。既に starter と一致する場合は新規 PR を作らず、確認した整理だけを行います。
- 明示的な教材マーカー、またはこの版以降の「実際に作成した」ローカル記録で識別できる Issue を**閉じます**。タイトルだけ、作成 / 再利用を区別できない旧記録だけ、重複マーカーは対象外です。本文・履歴は削除しません。**次の `./checkpoint1` も閉じた Issue を再利用し、自動で開き直しません。** 再度取り組む Issue は自分で開き直してください。
- 同じリポジトリの checkpoint PR は、元 snapshot SHA・参加者の親 commit・完全なファイル tree・PR 本文が確認できた場合だけ閉じます。追加コミットや provenance の変更があるものは保持します。ブランチ名だけでは削除せず、元 snapshot SHA を確認できる生成リモートブランチだけを整理します。
- 使用中 worktree、保持する open PR、reset 自身を保護します。fork または fork を持つ repo では外部 PR を網羅できないためブランチを削除しません。preview 後に変更された対象も保持します。**ローカルブランチは常に残し**、削除前の commit を `refs/workshop-reset/recovery/<SHA>` に保持して復帰コマンドを表示します。

変更済み / 未追跡ファイルは、checkout を切り替える場合に名前付き stash に保存します。自動で戻したり削除したりしません。ignored ファイル (`node_modules` など) は残し、starter と衝突すれば停止します。Codespace、認証、repo / アカウント設定、タグ、必須チェックは変更しません。starter がテスト workflow を削除しても既存 ruleset の必須チェックは残ります。チェックを回避せず、PR の条件を確認してください。reset の snapshot commit は `git commit-tree` で作り、`commit.gpgsign` を尊重しますが commit hook は実行しません。

途中失敗時は成功済みの処理と復帰情報を確認し、原因を解消して `./reset` を再実行します。確認を再度行い、既存の reset PR / 同じ commit を再利用し、閉じた対象や削除済みブランチは重複処理しません。マージせず閉じた reset PR は自動で開き直さず、新しい PR も重複作成しません。必要なら手動で開き直してください。変更された reset ブランチや、古い main / starter に対する未完了 reset は上書きせず停止します。Git 共通メタデータの `workshop-resets/` 記録を消さずに確認してください。古い未完了 reset を中止する場合も、その PR・ブランチ・記録の整合を手動で確認してから進めます。

**English:** Run `./reset` in your own repo after saving editor buffers. It previews the exact repo, starter SHA, issue/PR URLs, remote branch SHAs and skipped objects. Only typing the displayed `RESET github.com/OWNER/REPOSITORY` confirms writes; there is no `--yes`. It opens a full tracked-file starter-restoration PR from current canonical main, **not a rewrite of participant main**. Main changes only after you review and merge that PR. If main already matches, cleanup can still run without a new PR.

Cleanup **closes**, never permanently deletes, provably identified workshop issues and unmodified checkpoint PRs. Titles/prefixes alone and legacy reused-issue receipts are insufficient. Ambiguous or edited resources are retained. A later `./checkpoint1` reuses the closed issues without reopening or recreating them; reopen desired tasks yourself. Generated remote branches are deleted only with verified import commit/tree provenance, exact-SHA leases and recovery refs. Local branches, worktree-used branches, reset branches, and branches backing other open PRs are kept. Fork networks disable branch deletion conservatively.

Dirty/untracked work is stashed only if switching the checkout, never discarded or automatically reapplied. Existing stashes, ignored files, Codespaces, tags, settings and required checks stay intact; ignored-file collisions stop the operation. A starter PR may remove a workflow without removing its required-check rules. Snapshot commits honor signing configuration but do not run commit hooks. After partial failures, inspect the printed results and rerun: existing reset PRs/commits are reused, not duplicated. Closed-unmerged, edited or stale pending resets require manual inspection. Keep Git's `workshop-resets/` journal and `refs/workshop-reset/recovery/` refs. Never run checkpoint/reset commands concurrently, including across separate clones; local locks cannot coordinate different clones.

## 手動の前提条件

- VS Code と GitHub Copilot にサインインし、対象リポジトリへの権限を確認してください。
- MCP サーバーの信頼確認 / 起動 / OAuth 認証は各自で実施します。接続先 JSON だけで認証済みにはなりません。Context7 の利用条件 / 制限も確認し、トークンや API キーをコミットしないでください。
- Skill を読み込むため、新しい Copilot Chat を開いてください。認識しない版ではウィンドウを再読み込みし、必要なら `.agents/skills/` を `.github/skills/` に移動します。
- Cloud Agent の MCP 設定は VS Code とは別です。リポジトリの Settings > Copilot > MCP servers で設定してください。
- Copilot Code Review、CodeQL、Secret Scanning、Cloud Agent の有効化などのアカウント / リポジトリ設定は、このブランチには保存されません。
- 外部ドキュメント、MCP、Google Fonts にはネットワーク接続が必要です。フォント未取得時は fallback フォントで表示します。

どの checkpoint も前段の内容を含みます。Cloud Agent の機能を揃えてから TEST & SECURE のテストへ進みます。

## 再利用元

- 3D ギャラクシー: [theomonfort/theomonfort](https://github.com/theomonfort/theomonfort/tree/1ef7a254bd9a6eb2fdb29f13212e9054d6c75813), commit `1ef7a254bd9a6eb2fdb29f13212e9054d6c75813`。`PlaybookExplorer.astro` と `playbook-galaxy{,-scene,-models}.ts` を再利用し、日本語とルートパス用に接続。元の手続き型モデルをそのまま利用し、音声の UI / import / コールバックだけを分離。追加の glTF / テクスチャ素材は不要です。
- サイト / PLAN 手順: [theomonfort/theomonfort](https://github.com/theomonfort/theomonfort/tree/bd8b98d4f00060979e782e95d60ea74709b54da4), commit `bd8b98d4f00060979e782e95d60ea74709b54da4`。Playbook のカード / 詳細 / スタイルを抽出し、日本語・npm・ルートパス用に調整。ホームのゲーム、BGM、装備所、英語 UI は含めません。
- Skills: [theomonfort/skills](https://github.com/theomonfort/skills/tree/a8f7e7c092d3ed3e45860d416aec32fb115a4e21), commit `a8f7e7c092d3ed3e45860d416aec32fb115a4e21`。MIT ライセンスは `.agents/skills/LICENSE`。helper の案内はこの checkpoint 順序に合わせて調整しています。
- スターター: `v1.0.0`, commit `8145d5464c0265e1724807bb2cf1cca5f609640d`。
