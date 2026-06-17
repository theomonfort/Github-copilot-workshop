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
| `.vscode/mcp.json` | GitHub MCP Server 設定 |
| `src/content/playbook/ja/` | 最新の日本語 playbook |
| `src/content/playbook/en/` | 最新の英語 playbook |
| `src/lib/playbook-categories.ts` | category のラベル、説明、actor、avatar、色、表示順のメタデータ |
| `public/` | playbook 用の惑星、Octocat、背景、アイコンなどのサイト用アセット |

> `.github/` 配下の Copilot instruction files は、ワークショップ手順の中で作成します。

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
