# GitHub Copilot Workshop

ハンズオン教材の復帰用チェックポイント。`main` は content / assets から始めるスターターのままです。変更前の状態は release **1.0** (`v1.0.0`) に保存しています。

## このブランチ: checkpoint/01-develop

PLAN のハーネスと、日本語 Playbook の基本サイトを含みます。

- `.github/copilot-instructions.md` と `.github/instructions/frontend.instructions.md`: Astro / Tailwind / TypeScript / npm、レトロ JRPG テーマの規約
- `.vscode/mcp.json`: GitHub MCP と Context7 の接続先
- `.agents/skills/`: `github-issues` と `hands-on-helper` (参照ファイル / ライセンスを同梱)
- `/playbook/`: カテゴリ別カード、SDLC ナビゲーション、惑星 / アバター / カテゴリメタデータ
- `/playbook/<slug>/`: 日本語 Markdown 全文、リンク集、前後のページ、「Playbook に戻る」

プレゼンモードは **02-cloud-agent**、E2E / PR テストは **03-tests** で追加します。ここでは Mermaid はコードブロック表示です。英語 Markdown は保持しますが、サイトは日本語のみです。

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

## 手動の前提条件

- VS Code と GitHub Copilot にサインインし、対象リポジトリへの権限を確認してください。
- MCP サーバーの信頼確認 / 起動 / OAuth 認証は各自で実施します。接続先 JSON だけで認証済みにはなりません。Context7 の利用条件 / 制限も確認してください。
- Skill を読み込むため、新しい Copilot Chat を開いてください。認識しない版ではウィンドウを再読み込みし、必要なら `.agents/skills/` を `.github/skills/` に移動します。
- Cloud Agent の MCP 設定は VS Code とは別です。リポジトリの Settings > Copilot > MCP servers で設定してください。
- Copilot Code Review、CodeQL、Secret Scanning、Cloud Agent の有効化などのアカウント / リポジトリ設定は、このブランチには保存されません。
- 外部ドキュメント、MCP、Google Fonts にはネットワーク接続が必要です。フォント未取得時は fallback フォントで表示します。

## デモ途中から安全に復帰する

**未保存のエディタ内容を保存してから**、現在の変更を commit または stash に退避します。以下は untracked ファイルも含める stash の例です (`node_modules` など ignored ファイルは対象外)。

```bash
git status
git stash push --include-untracked -m "workshop demo before checkpoint"
git stash list
```

commit を選ぶ場合は秘密情報がないことを確認し、`git add <保存するファイル>` と `git commit` で保存します。stash は元の作業ブランチに戻って `git stash apply` で復元できます。確認前に drop しないでください。

テンプレートから作った自分のリポジトリに checkpoint ブランチがなくても、元教材から **名前を指定して取得**できます。`origin` の変更や merge / reset は不要です。

```bash
git fetch https://github.com/theomonfort/Github-copilot-workshop.git refs/heads/checkpoint/01-develop
git switch -c workshop-develop FETCH_HEAD
npm ci
npm run dev
```

`workshop-develop` は新しい作業ブランチ名です。既に存在する場合は別名を使ってください。作業を自分のリポジトリに保存する場合は `git push -u origin workshop-develop`。`git reset --hard` や checkpoint への merge は行いません。

| 再開地点 | fetch する ref | 新しい作業ブランチ例 |
|---|---|---|
| 基本サイト完成後 | `refs/heads/checkpoint/01-develop` | `workshop-develop` |
| Cloud Agent のプレゼン機能完成後 | `refs/heads/checkpoint/02-cloud-agent` | `workshop-presentation` |
| E2E / PR テスト完成後 | `refs/heads/checkpoint/03-tests` | `workshop-tested` |

上の fetch コマンドの ref と `git switch -c` の名前を目的の行に置き換えます。どの checkpoint も前段の内容を含みます。Cloud Agent の機能を揃えてから TEST & SECURE のテストへ進みます。

## 再利用元

- サイト / PLAN 手順: [theomonfort/theomonfort](https://github.com/theomonfort/theomonfort/tree/bd8b98d4f00060979e782e95d60ea74709b54da4), commit `bd8b98d4f00060979e782e95d60ea74709b54da4`。Playbook のカード / 詳細 / スタイルを抽出し、日本語・npm・ルートパス用に調整。ホームのゲーム、BGM、装備所、英語 UI は含めません。
- Skills: [theomonfort/skills](https://github.com/theomonfort/skills/tree/a8f7e7c092d3ed3e45860d416aec32fb115a4e21), commit `a8f7e7c092d3ed3e45860d416aec32fb115a4e21`。MIT ライセンスは `.agents/skills/LICENSE`。helper の案内はこの checkpoint 順序に合わせて調整しています。
- スターター: `v1.0.0`, commit `8145d5464c0265e1724807bb2cf1cca5f609640d`。
