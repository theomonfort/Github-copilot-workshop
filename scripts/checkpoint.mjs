import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIssues } from './checkpoint-issues.mjs';
import { createContext, operationLock, preflight, preserveIgnoredFiles, quote, requireThat, source } from './checkpoint-common.mjs';

// Node loads this module before switch/restore can replace its on-disk files.
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const stages = [
  {
    name: '01-develop',
    title: 'Website scaffold',
    summary: 'PLAN ハーネスと、Playbook の一覧 / 詳細を備えた基本サイトの完成例です。',
    inspect: '一覧と詳細を確認',
  },
  {
    name: '02-cloud-agent',
    title: 'Website with presentation mode',
    summary: 'PLAN ハーネスと、一覧 / 詳細 / プレゼンを備えたサイトの完成例です。',
    inspect: 'カードからプレゼンを開き、移動と目次を確認',
  },
  {
    name: '03-tests',
    title: 'Complete website with tests and CI',
    summary: 'PLAN ハーネスと 2D / 3D / プレゼン対応サイト、Playwright テスト、PR CI の完成例です。',
    inspect: '2D / 3D、詳細、プレゼンを確認',
  },
];
const state = { completed: [], step: 'checking prerequisites' };
const context = createContext(root);
const { git, run } = context;
const done = (message) => { state.completed.push(message); console.log(message); };

function pullRequestBody(stage, checkpoint, snapshot, base) {
  const validation = stage.name === '03-tests'
    ? '更新済み Dev Container では Chromium の導入は不要です。コンテナ外のみ `npx playwright install --with-deps chromium`。`npm run check` → `npm run test:e2e`。PR の CI 結果も確認してください。'
    : '`npm run check` → `npm run build`。';
  return `${stage.summary}

取り込みコマンドが PR 作成後に \`npm ci\` を実行します。成功後は \`npm run dev\`。表示 URL（Codespaces は転送 URL）の \`/playbook/\` で${stage.inspect}。

**差分:** 全追跡ファイルを置換します。独自変更と削除を確認してください。

**教材:** 意図的な脆弱性と品質問題はサイトから隔離しています。検出例は \`workshop-exercises/README.md\`。

必須チェックは回避せず、依存監査の警告とは分けて確認してください。

<details>
<summary>取り込み元と確認コマンド</summary>

- チェックポイント: \`${checkpoint}\`
- 元リポジトリ: ${source}
- スナップショット SHA: \`${snapshot}\`
- 参加者の main SHA: \`${base}\`

前段の取り込みは不要です。ファイルのみを取り込み、元リポジトリの履歴はマージしません。

別ターミナルでの確認（取り込みスクリプトでは未実行）: ${validation}
</details>`;
}

function installDependencies(tree) {
  state.step = 'checking the checkout before dependency installation';
  requireThat(git(['rev-parse', 'HEAD^{tree}']).text === tree
    && !git(['status', '--porcelain=v1', '--untracked-files=all']).text,
  '依存関係は未導入です。現在の checkout が取得した snapshot と異なるか、未コミット・未追跡の変更があります。作業を保存し、取り込み済みブランチへ手動で切り替えてから checkpoint を再実行してください。checkout は自動で変更しません。');
  state.step = 'installing project dependencies';
  console.log('取り込んだ package-lock.json で npm ci を実行します（node_modules は再作成されます）。');
  const result = run('npm', ['ci']);
  if (result.text) console.log(result.text);
  done('npm ci が完了しました。npm run dev で起動できます。');
}

function main() {
  const number = process.argv[2];
  requireThat(process.argv.length === 3 && /^[123]$/.test(number), 'Use ./checkpoint1, ./checkpoint2, or ./checkpoint3.');
  const { target, metadata } = preflight(context);
  run('npm', ['--version']);
  if (number === '1') requireThat(metadata.has_issues === true,
    'checkpoint1 needs Issues enabled in the participant repository and gh access to read/create issues. Repository settings were not changed.');
  state.release = operationLock(context, target, metadata);
  state.original = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1]).text;
  state.originalHead = git(['rev-parse', 'HEAD']).text;
  const stage = stages[Number(number) - 1];
  const checkpoint = `checkpoint/${stage.name}`;
  state.repo = `${target.host}/${target.path}`;
  state.step = 'fetching participant main';
  const fetchOptions = ['fetch', '--no-tags', '--no-prune', '--no-recurse-submodules', '--refmap='];
  git([...fetchOptions, 'origin', 'refs/heads/main']);
  const base = git(['rev-parse', 'FETCH_HEAD^{commit}']).text;
  done(`Fetched participant main: ${base}`);
  state.step = 'fetching canonical checkpoint';
  git([...fetchOptions, source, `refs/heads/${checkpoint}`]);
  const snapshot = git(['rev-parse', 'FETCH_HEAD^{commit}']).text;
  const tree = git(['rev-parse', `${snapshot}^{tree}`]).text;
  for (const path of ['checkpoint1', 'checkpoint2', 'checkpoint3', 'reset', 'scripts/reset.mjs', 'scripts/checkpoint-common.mjs', 'scripts/checkpoint.mjs', 'scripts/checkpoint-issues.mjs', 'scripts/checkpoint-issues.json', 'package.json', 'package-lock.json']) {
    const entry = git(['ls-tree', snapshot, '--', path]).text;
    requireThat(entry.startsWith(path.startsWith('checkpoint') || path === 'reset' ? '100755 blob ' : '100644 blob '),
      `The canonical snapshot is missing a usable ${path}; nothing was switched.`);
  }
  done(`Fetched canonical ${checkpoint}: ${snapshot}`);
  const alreadyImported = git(['rev-parse', `${base}^{tree}`]).text === tree;
  if (!alreadyImported) preserveIgnoredFiles(context, base, snapshot);
  if (number === '1') {
    state.step = 'preparing workshop issues';
    const catalogue = JSON.parse(git(['show', `${snapshot}:scripts/checkpoint-issues.json`]).text);
    prepareIssues(catalogue, {
      directory: resolve(root, git(['rev-parse', '--git-common-dir']).text, 'workshop-issues'),
      target, metadata, run, done,
    });
  }
  if (alreadyImported) {
    console.log('origin/main already matches this snapshot. No stash, branch, commit, push or PR was created.');
    installDependencies(tree);
    return;
  }
  // Issue API の待機中に増えた ignored ファイルも、checkout 変更前に保護する。
  if (number === '1') preserveIgnoredFiles(context, base, snapshot);
  const prefix = `workshop-checkpoint${number}`;
  const local = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads']).text.split('\n');
  const remote = git(['ls-remote', '--heads', 'origin']).text
    .split('\n').filter(Boolean).map((line) => line.split('\t')[1].replace('refs/heads/', ''));
  const taken = [...local, ...remote].map((name) => name.toLowerCase());
  let branch = prefix;
  for (let suffix = 2; taken.some((name) => name === branch || name.startsWith(`${branch}/`)); suffix++) {
    branch = `${prefix}-${suffix}`;
  }
  state.step = 'preserving current work';
  if (git(['status', '--porcelain=v1', '--untracked-files=all']).text) {
    const before = git(['rev-parse', '--verify', '--quiet', 'refs/stash'], [0, 1]).text;
    git(['stash', 'push', '--include-untracked', '-m', `workshop checkpoint${number} before import ${new Date().toISOString()}`]);
    const stash = git(['rev-parse', 'refs/stash']).text;
    requireThat(stash !== before, 'No new stash was created; inspect git status before retrying.');
    state.stash = stash;
    done(`Saved tracked and untracked work in stash ${stash}. It will NOT be reapplied automatically.`);
  }
  requireThat(!git(['status', '--porcelain=v1', '--untracked-files=all']).text, 'Worktree is not clean after stashing; stop and inspect git status.');
  state.step = 'creating the participant work branch';
  git(['switch', '-c', branch, base]);
  state.branch = branch;
  done(`Created ${branch} from participant main.`);
  state.step = 'importing the snapshot';
  git(['restore', `--source=${snapshot}`, '--staged', '--worktree', '--', '.']);
  requireThat(git(['write-tree']).text === tree, 'The staged tree differs from the canonical snapshot; inspect git status.');
  done('Imported checkpoint files only; canonical commit history was not merged.');
  state.step = 'committing the snapshot';
  state.title = stage.title;
  state.body = pullRequestBody(stage, checkpoint, snapshot, base);
  const commitBody = `Import files from ${source} at ${snapshot} (${checkpoint}). Based on participant main ${base}; canonical history is not merged. Review this snapshot before merging.`;
  git(['commit', '-m', `Import workshop ${checkpoint}`, '-m', commitBody]);
  state.commit = git(['rev-parse', 'HEAD']).text;
  requireThat(git(['rev-parse', 'HEAD^{tree}']).text === tree, 'A commit hook changed the snapshot; inspect the commit before publishing.');
  done(`Committed ${state.commit}.`);
  state.step = 'pushing the new branch';
  // An empty lease is create-only: a concurrently created remote branch must never be updated.
  git(['push', '--no-follow-tags', '--recurse-submodules=no', `--force-with-lease=refs/heads/${branch}:`,
    '--set-upstream', 'origin', `HEAD:refs/heads/${branch}`]);
  state.pushed = true;
  done(`Pushed only ${branch} to participant origin.`);
  state.step = 'opening the pull request';
  state.prArgs = ['pr', 'create', '--repo', state.repo, '--base', 'main', '--head', branch, '--title', state.title, '--body', state.body];
  console.log(run('gh', state.prArgs).text);
  state.prCreated = true;
  done('PR created. No PR was merged.');
  installDependencies(tree);
}

try {
  main();
} catch (error) {
  console.error(`Stopped while ${state.step}: ${error.message}`);
  console.error(`Completed: ${state.completed.join(' | ') || 'none; no checkout changes made'}`);
  console.error('No automatic rollback was attempted. Inspect git status first.');
  if (state.step === 'preparing workshop issues') {
    console.error('Issue preparation stopped before stash/checkout/commit/push/PR changes. Keep created issues and their identity markers. After resolving the reported error, rerun ./checkpoint1 to reuse existing issues and prepare only missing ones.');
  }
  if (state.branch) console.error(`Your work branch is ${state.branch}; existing branches and main were not updated.`);
  if (state.step === 'installing project dependencies') {
    console.error(`依存関係の導入は未完了です。取り込んだファイル・commit・作成済み PR は保持しています。エラーを解消し、同じ checkout で再試行してください:\ncd ${quote(root)} && npm ci\nPR の作り直しや checkpoint の再取り込みは不要です。`);
  }
  if (state.commit && !state.pushed) {
    console.error(`First check: git ls-remote origin refs/heads/${state.branch}\nIf it already points to ${state.commit}, skip the push and open the PR. Never overwrite another commit.`);
    console.error(`After checking origin and branch availability, retry the create-only push:\ngit push --no-follow-tags --recurse-submodules=no --force-with-lease=refs/heads/${state.branch}: --set-upstream origin ${state.commit}:refs/heads/${state.branch}`);
  }
  if (state.commit && !state.prCreated) {
    console.error(`Check for an existing PR before retrying: gh pr list --repo ${state.repo} --head ${state.branch}`);
    const args = state.prArgs ?? ['pr', 'create', '--repo', state.repo, '--base', 'main', '--head', state.branch, '--title', state.title, '--body', state.body];
    console.error(`After the branch is pushed: gh ${args.map(quote).join(' ')}`);
    console.error(`PR 作成を手動で復旧した後、依存関係を導入してください:\ncd ${quote(root)} && npm ci`);
  }
  process.exitCode = 1;
} finally {
  state.release?.();
  if (state.stash) {
    const back = state.original ? `git switch ${quote(state.original)}` : `git switch --detach ${state.originalHead}`;
    console.log(`Saved work remains in stash ${state.stash}. When safe, return to the original checkout:\n${back}\ngit stash apply --index ${state.stash}\nKeep the stash until you have checked the restored files.`);
  }
}
