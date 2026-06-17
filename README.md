# GitHub Copilot Workshop

ハンズオン教材リポジトリ。`src/content/` の Markdown / MDX と `public/` の画像アセットを題材に、GitHub Copilot を使って閲覧用サイトを Astro で組み立てます。

## はじめに

1. このリポジトリを **Use this template → Create a new repository** で自分用にコピー
2. **Code → Codespaces → Create codespace on main** で開発環境を起動
3. ハンズオンの手順は [ワークショップ資料](https://theomonfort.github.io/theomonfort/handson/intro/) を参照

## 構成

| パス | 内容 |
|---|---|
| `.devcontainer/devcontainer.json` | Codespaces / Dev Containers の定義 |
| `.vscode/mcp.json` | GitHub MCP Server 設定 |
| `src/content/playbook/` | 題材コンテンツ (Markdown)。ルート直下は日本語 playbook の互換コピー |
| `src/content/playbook/ja/` | 最新の日本語 playbook |
| `src/content/playbook/en/` | 最新の英語 playbook |
| `src/content/handson/` | 最新のハンズオン手順 (MDX) |
| `src/content/equipment/` | 装備所カード用の最新 Markdown |
| `public/` | 惑星、Octocat、背景、アイコン、ハンズオン画像などのサイト用アセット |

## コンテンツに含まれる要素

`src/content/playbook/` の Markdown には以下が含まれます。サイト構築時にレンダリング対応が必要です：

- **Mermaid 図** （` ```mermaid ` ブロック）：アーキテクチャ図やフローを表現
- **コードブロック**：シンタックスハイライト推奨
- **テーブル、リスト、見出し**：標準的な Markdown 要素

> 💡 サイト構築のプロンプトで「Mermaid 図をレンダリングできるようにする」と明示すると確実です。

## Copilot Chat セクションで試すこと

まずは presentation mode ではなく、**playbook landing page** を作るところから始めます。

- `src/content/playbook/` の Markdown を読み込んでカード一覧を表示
- `public/planet-*.webp` や `public/icons/` を使ってカテゴリごとの見た目を作る
- `public/room/equipment-room.png`、Octocat 画像、背景画像を必要に応じて使う
- その後のステップで詳細ページや presentation mode に拡張する
