import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareIssues } from './checkpoint-issues.mjs';

// Node loads this module before switch/restore can replace its on-disk files.
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const source = 'https://github.com/theomonfort/Github-copilot-workshop.git';
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
    summary: 'PLAN ハーネスとプレゼン対応サイト、Playwright テスト、PR CI の完成例です。',
    inspect: '一覧、詳細、プレゼンを確認',
  },
];
const state = { completed: [], step: 'checking prerequisites' };
const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' };
const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

function run(command, args, accepted = [0]) {
  const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.error) throw new Error(`${command}: ${result.error.message}`);
  if (!accepted.includes(result.status)) {
    throw new Error(`${command} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
  }
  return { text: result.stdout.trim(), status: result.status };
}
const git = (args, accepted) => run('git', args, accepted);
const done = (message) => { state.completed.push(message); console.log(message); };
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

function pullRequestBody(stage, checkpoint, snapshot, base) {
  const validation = stage.name === '03-tests'
    ? '`npx playwright install chromium`（Linux: `npx playwright install --with-deps chromium`）→ `npm run check` → `npm run test:e2e`。PR の CI 結果も確認してください。'
    : '`npm run check` → `npm run build`。';
  return `${stage.summary}

\`npm ci\` → \`npm run dev\`。表示 URL（Codespaces は転送 URL）の \`/playbook/\` で${stage.inspect}。

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

function repository(remote) {
  let host, path;
  if (/^(https|ssh):\/\//.test(remote)) {
    const url = new URL(remote);
    requireThat(!url.password && (url.protocol === 'ssh:' || !url.username),
      'Use SSH or a credential helper, not credentials embedded in an origin URL.');
    host = url.protocol === 'ssh:' ? url.hostname : url.host;
    path = url.pathname;
  } else {
    const match = remote.match(/^(?:[^@/:]+@)?([^/:]+):([^:]+)$/);
    requireThat(match, 'origin must use a GitHub HTTPS or SSH URL.');
    [, host, path] = match;
  }
  path = path.replace(/^\/|\/$/g, '').replace(/\.git$/, '');
  requireThat(/^[a-z0-9.-]+(?::\d+)?$/i.test(host) && /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(path),
    'Cannot identify the GitHub repository from origin.');
  requireThat(!(host.toLowerCase().replace(/:443$/, '') === 'github.com'
    && path.toLowerCase() === 'theomonfort/github-copilot-workshop'),
  'Run this command in your own repository, not the canonical workshop template.');
  return { host, path, key: `${host}/${path}`.toLowerCase() };
}

function preserveIgnoredFiles(main, snapshot) {
  const paths = new Set();
  for (const sha of [main, snapshot]) {
    const entries = git(['ls-tree', '-rz', sha]).text.split('\0').filter(Boolean);
    for (const entry of entries) {
      requireThat(!entry.startsWith('160000 '), 'Submodule snapshots are not supported.');
      const path = entry.slice(entry.indexOf('\t') + 1);
      paths.add(path);
      for (let parent = dirname(path); parent !== '.'; parent = dirname(parent)) {
        const stat = lstatSync(join(root, parent), { throwIfNoEntry: false });
        if (stat && !stat.isDirectory()) paths.add(parent);
      }
    }
  }
  const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--',
    ...[...paths].map((path) => `:(literal)${path}`)]).text;
  requireThat(!ignored, `Ignored files would be replaced. Move them to a safe location first:\n${ignored.split('\0').join('\n')}`);
}

function main() {
  const number = process.argv[2];
  requireThat(process.argv.length === 3 && /^[123]$/.test(number), 'Use ./checkpoint1, ./checkpoint2, or ./checkpoint3.');
  const [major, minor] = process.versions.node.split('.').map(Number);
  requireThat(major > 22 || (major === 22 && minor >= 12), 'Node.js 22.12+ is required.');
  const version = git(['--version']).text.match(/(\d+)\.(\d+)/);
  requireThat(version && (+version[1] > 2 || (+version[1] === 2 && +version[2] >= 23)), 'Git 2.23+ is required.');
  requireThat(realpathSync(git(['rev-parse', '--show-toplevel']).text) === root, 'Run the commands from a normal workshop checkout.');
  const fetchURLs = git(['remote', 'get-url', '--all', 'origin']).text.split('\n');
  const pushURLs = git(['remote', 'get-url', '--push', '--all', 'origin']).text.split('\n');
  requireThat(fetchURLs.length === 1 && pushURLs.length === 1, 'origin must have exactly one fetch URL and one push URL.');
  const target = repository(fetchURLs[0]);
  requireThat(repository(pushURLs[0]).key === target.key, 'origin fetch and push must point to the same participant repository.');
  requireThat(git(['config', '--bool', '--get', 'remote.origin.mirror'], [0, 1]).text !== 'true', 'Mirror origins are not supported.');
  requireThat(git(['config', '--bool', '--get', 'core.sparseCheckout'], [0, 1]).text !== 'true', 'Use a full checkout, not a sparse checkout.');
  for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'sequencer', 'BISECT_LOG']) {
    requireThat(!existsSync(resolve(root, git(['rev-parse', '--git-path', marker]).text)), `Finish the existing Git operation (${marker}) first.`);
  }
  requireThat(!git(['ls-files', '--unmerged']).text, 'Resolve existing Git conflicts first.');
  requireThat(!git(['ls-files', '--stage', '-z']).text.split('\0').some((entry) => entry.startsWith('160000 ')),
    'Submodule worktrees are not supported; their changes cannot be safely stashed here.');
  git(['var', 'GIT_AUTHOR_IDENT']);
  git(['var', 'GIT_COMMITTER_IDENT']);
  run('gh', ['auth', 'status', '--hostname', target.host]);
  const metadata = JSON.parse(run('gh', ['api', '--hostname', target.host, `repos/${target.path}`]).text);
  const resolved = repository(metadata.clone_url);
  requireThat(resolved.key === target.key, 'origin resolves to a different repository; update origin explicitly first.');
  requireThat(metadata.permissions?.push === true && !metadata.archived && !metadata.disabled,
    'Your gh account needs push access to an active participant repository.');
  if (number === '1') requireThat(metadata.has_issues === true,
    'checkpoint1 needs Issues enabled in the participant repository and gh access to read/create issues. Repository settings were not changed.');
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
  for (const path of ['checkpoint1', 'checkpoint2', 'checkpoint3', 'scripts/checkpoint.mjs', 'scripts/checkpoint-issues.mjs', 'scripts/checkpoint-issues.json']) {
    const entry = git(['ls-tree', snapshot, '--', path]).text;
    requireThat(entry.startsWith(path.startsWith('checkpoint') ? '100755 blob ' : '100644 blob '),
      `The canonical snapshot is missing a usable ${path}; nothing was switched.`);
  }
  done(`Fetched canonical ${checkpoint}: ${snapshot}`);
  const alreadyImported = git(['rev-parse', `${base}^{tree}`]).text === tree;
  if (!alreadyImported) preserveIgnoredFiles(base, snapshot);
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
    return;
  }
  // Issue API の待機中に増えた ignored ファイルも、checkout 変更前に保護する。
  if (number === '1') preserveIgnoredFiles(base, snapshot);
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
  done('PR created. No PR was merged.');
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
  if (state.commit && !state.pushed) {
    console.error(`First check: git ls-remote origin refs/heads/${state.branch}\nIf it already points to ${state.commit}, skip the push and open the PR. Never overwrite another commit.`);
    console.error(`After checking origin and branch availability, retry the create-only push:\ngit push --no-follow-tags --recurse-submodules=no --force-with-lease=refs/heads/${state.branch}: --set-upstream origin ${state.commit}:refs/heads/${state.branch}`);
  }
  if (state.commit) {
    console.error(`Check for an existing PR before retrying: gh pr list --repo ${state.repo} --head ${state.branch}`);
    const args = state.prArgs ?? ['pr', 'create', '--repo', state.repo, '--base', 'main', '--head', state.branch, '--title', state.title, '--body', state.body];
    console.error(`After the branch is pushed: gh ${args.map(quote).join(' ')}`);
  }
  process.exitCode = 1;
} finally {
  if (state.stash) {
    const back = state.original ? `git switch ${quote(state.original)}` : `git switch --detach ${state.originalHead}`;
    console.log(`Saved work remains in stash ${state.stash}. When safe, return to the original checkout:\n${back}\ngit stash apply --index ${state.stash}\nKeep the stash until you have checked the restored files.`);
  }
}
