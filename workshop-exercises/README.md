# 意図的な解析演習 / Intentional analysis exercises

**教材専用。製品に出荷しないでください。Do not import, serve, or execute these files.**

各 checkpoint は新しいセキュリティ問題 1 件と品質問題 1 件を追加し、前段の教材を保持します。このフォルダーは `src/`、`public/`、アプリの TypeScript 対象、E2E から分離しています。通常の Astro build / preview / test は教材の関数を呼び出しません。サーバー、公開ルート、実在の接続先、資格情報はありません。解析には実行不要の TypeScript を使います。

Each checkpoint adds one new security example and one new quality example. The examples are cumulative and inert: no top-level calls, application imports, server routes, real endpoints, or credentials. Static analysis reads their source without executing it. Never add them to the application or its tests.

## 講師用マップ / Instructor map

このブランチに含まれるファイルのみを確認します。各ルール名は公式の検出仕様へのリンクです。

| 追加 checkpoint | ファイル | 種類と期待ルール | 問題 / Why | 修正 / Remediation |
| --- | --- | --- | --- | --- |
| 1 | `01-develop/security-disabled-tls.ts` | Security: [js/disabling-certificate-validation](https://codeql.github.com/codeql-query-help/javascript/js-disabling-certificate-validation/) | 接続先の証明書を検証しない / TLS peer identity is not verified | `rejectUnauthorized: false` を削除し、既定の検証を使う |
| 1 | `01-develop/quality-duplicate-condition.ts` | Quality: [js/duplicate-condition](https://codeql.github.com/codeql-query-help/javascript/js-duplicate-condition/) | 2 番目の条件が同じで到達不能 / Copy-paste condition makes the second branch unreachable | 2 番目を意図した状態 (`finished`) と比較する |
| 2 | `02-cloud-agent/security-dom-xss.ts` | Security: [js/xss](https://codeql.github.com/codeql-query-help/javascript/js-xss/) | URL の内容を HTML として解釈 / URL-controlled text reaches an HTML sink | 文字列表示なら `textContent` を使う。教材をページに接続しない |
| 2 | `02-cloud-agent/quality-nan-comparison.ts` | Quality: [js/comparison-with-nan](https://codeql.github.com/codeql-query-help/javascript/js-comparison-with-nan/) | `NaN` との等価比較は常に false / Equality cannot identify NaN | `Number.isNaN(value)` を使う |
| 3 | `03-tests/security-weak-key.ts` | Security: [js/insufficient-key-size](https://codeql.github.com/codeql-query-help/javascript/js-insufficient-key-size/) | 1024-bit RSA は短すぎる / RSA key size is below the security baseline | 2048-bit 以上を使う。この教材の関数は実行せず、鍵を生成しない |
| 3 | `03-tests/quality-ignored-array-result.ts` | Quality: [js/ignore-array-result](https://codeql.github.com/codeql-query-help/javascript/js-ignore-array-result/) | `concat` は元の配列を変更しない / Ignoring the returned array loses the update | `return labels.concat(items)` のように戻り値を使う |

## 実際の検出を確認する / Observe, do not assume

公式教材の **Actions > Workshop exercise analysis** で対象 checkpoint の実行を確認します。`workshop-exercise-findings` artifact の `findings.json` / `summary.md` は、`expected-findings.json` の期待ルールと、解析が本当に報告したファイル・行を対比します。`Not detected` は検出未確認を意味します。修正済みの教材は検出されなくて正常です。この検証は脆弱性を残すことを要求しません。

The proof workflow runs **only in `theomonfort/Github-copilot-workshop`** and statically analyzes **only this exercise directory**, using the official CodeQL `security-and-quality` suite. It is skipped in template copies, so importing a checkpoint cannot conflict with a participant's existing CodeQL default setup or upload duplicate advanced-setup results. It does not replace full-application analysis. Inspect the actual report rather than treating an enabled feature or a green workflow as proof that a particular issue was found.

参加者は `./checkpoint1` / `./checkpoint2` / `./checkpoint3` で PR を開き、**自分のリポジトリで既に設定した CodeQL default setup** の結果を確認します。3 つのセキュリティ例は標準 code scanning suite の対象です。Code Quality のコメントは、その別サービスが有効な場合に確認してください。設定がなければ検出 UI は自動で出ません。

| 機能 / Tool | この教材での証拠 / Evidence |
| --- | --- |
| **CodeQL code scanning** | 公式教材だけで `security.sarif` のセキュリティ検出をアップロード。参加者は既存 default setup の結果を使う。Security の code scanning で対象ブランチ / PR を選ぶ。 |
| **CodeQL quality rules** | `quality.sarif` は artifact に保存。公式 [GitHub Code Quality の JavaScript ルール一覧](https://docs.github.com/en/code-security/reference/code-quality/codeql-queries/javascript-queries)に掲載された決定的ルールを検証する。code scanning のセキュリティ検出とは混ぜない。 |
| **GitHub Code Quality** | 別製品。実際に有効な repo では `github-code-quality[bot]` の PR コメントを確認。この workflow はその bot / サービスを有効化せず、その実行を証明しない。 |
| **Copilot code review** | AI による別のレビュー。コメントは非決定的で、CodeQL / Code Quality の検出証拠ではない。 |
| **Secret scanning** | この教材では検証しない。実際の secret を作成・コミットしない。 |

GitHub Code Quality has separate [licensing and AI-credit billing](https://docs.github.com/en/billing/concepts/product-billing/github-code-quality). The template does not enable it or authorize a purchase. CodeQL upload also requires the participant repository's access, eligible plan/visibility, Actions permissions, and security settings. A private workshop repository may need GitHub Code Security. If a check cannot run or upload, report that prerequisite; do not disable policies, suppress findings, or bypass required checks.

**default setup** の保護を無断で切り替えず、講師と解析方式を確認します。教材の workflow の repo 条件を削除して二重解析を開始しないでください。GitHub 側の設定はテンプレートの branch からコピーされません。

## 修正する演習 / Remediation

1. 実際のルールと該当行を読む。アプリから教材を呼び出して再現しない。
2. 教材の関数だけを安全・正確に修正し、同じ PR を更新する。
3. 再解析でその検出が消えたことを確認する。未実行・失敗と、検出ゼロを区別する。

Only fix the exercise files. Do not ignore/exclude them, weaken a quality/security gate, or merge around required checks. A later checkpoint imports the canonical exercise snapshot, so previously fixed examples may reappear; inspect the PR diff and reapply your fixes deliberately.
