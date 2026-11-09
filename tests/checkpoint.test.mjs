import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['checkpoint1', 'checkpoint2', 'checkpoint3', 'scripts/checkpoint.mjs', 'scripts/checkpoint-issues.mjs', 'scripts/checkpoint-issues.json'];
const catalogue = JSON.parse(readFileSync(join(project, 'scripts/checkpoint-issues.json'), 'utf8'));
const stages = ['01-develop', '02-cloud-agent', '03-tests'];
const titles = ['Website scaffold', 'Website with presentation mode', 'Complete website with tests and CI'];

function fixture(t, { copied = false, https = false } = {}) {
  const sandbox = mkdtempSync(join(tmpdir(), 'workshop-checkpoint-test-'));
  t.after(() => rmSync(sandbox, { recursive: true, force: true }));
  const participant = join(sandbox, 'participant');
  const origin = join(sandbox, 'origin.git');
  const canonical = join(sandbox, 'canonical');
  const source = join(sandbox, 'source.git');
  const bin = join(sandbox, 'bin');
  mkdirSync(bin);
  const env = {
    ...process.env, HOME: sandbox, GIT_CONFIG_GLOBAL: join(sandbox, 'gitconfig'), GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_AUTHOR_NAME: 'Workshop Test', GIT_AUTHOR_EMAIL: 'workshop@example.invalid',
    GIT_COMMITTER_NAME: 'Workshop Test', GIT_COMMITTER_EMAIL: 'workshop@example.invalid',
    GIT_SSH_COMMAND: join(bin, 'ssh'), GIT_SSH_VARIANT: 'ssh',
    PATH: `${bin}:${process.env.PATH}`, TEST_ORIGIN: origin, TEST_SOURCE: source,
    TEST_GH_LOG: join(sandbox, 'gh.log'), TEST_SSH_LOG: join(sandbox, 'ssh.log'),
    TEST_ISSUES: join(sandbox, 'issues.json'),
  };
  function git(cwd, ...args) {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`);
    return result.stdout.trim();
  }
  git(sandbox, 'config', '--global', 'url.git@github.com:.insteadOf', 'https://github.com/');
  git(sandbox, 'config', '--global', 'init.defaultBranch', 'main');
  git(sandbox, 'config', '--global', 'commit.gpgsign', 'false');
  writeFileSync(env.TEST_ISSUES, '[]');
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_GH_LOG, JSON.stringify(a) + '\\n');
if (a[0] === 'auth') process.exit(process.env.FAIL_AUTH ? 1 : 0);
if (a[0] === 'api') {
  if (a[a.indexOf('--hostname') + 1] !== 'github.com') process.exit(90);
  const endpoint = a.find(arg => arg.startsWith('repos/'));
  if (endpoint === 'repos/workshop-tests/participant') {
    console.log(JSON.stringify({id: 314, clone_url: 'https://github.com/' + (process.env.REDIRECT_SOURCE ? 'theomonfort/Github-copilot-workshop' : 'workshop-tests/participant') + '.git', permissions: {push: !process.env.NO_PUSH}, archived: false, has_issues: !process.env.ISSUES_DISABLED}));
  } else if (endpoint === 'repos/workshop-tests/participant/issues' && a[a.indexOf('--method') + 1] === 'POST') {
    const field = name => a.find(arg => arg.startsWith(name + '='))?.slice(name.length + 1);
    const title = field('title'), body = field('body');
    const key = title.slice('[playbook:'.length, title.indexOf(']'));
    if (process.env.FAIL_ISSUE_CREATE || process.env.FAIL_ISSUE_KEY === key) { console.error('Simulated issue create permission failure (HTTP 403)'); process.exit(1); }
    const issues = JSON.parse(fs.readFileSync(process.env.TEST_ISSUES, 'utf8'));
    const number = Math.max(40, ...issues.map(issue => issue.number)) + 3;
    const issue = {number, title, body, state: 'open', html_url: 'https://github.com/workshop-tests/participant/issues/' + number};
    issues.push(issue);
    fs.writeFileSync(process.env.TEST_ISSUES, JSON.stringify(issues));
    if (process.env.LOSE_ISSUE_RESPONSE_KEY === key) { console.error('Simulated connection lost after issue creation'); process.exit(1); }
    console.log(JSON.stringify(issue));
  } else if (endpoint === 'repos/workshop-tests/participant/issues?state=all&per_page=100&sort=created&direction=asc') {
    if (!a.includes('--paginate') || !a.includes('--slurp')) process.exit(90);
    if (process.env.FAIL_ISSUE_READ) { console.error('Simulated issue read permission failure (HTTP 403)'); process.exit(1); }
    const issues = JSON.parse(fs.readFileSync(process.env.TEST_ISSUES, 'utf8'));
    const pages = [];
    for (let i = 0; i < issues.length; i += 2) pages.push(issues.slice(i, i + 2));
    console.log(JSON.stringify(pages.length ? pages : [[]]));
  } else process.exit(90);
} else if (a[0] === 'pr' && a[1] === 'create') {
  if (a[a.indexOf('--repo') + 1] !== 'github.com/workshop-tests/participant' || a[a.indexOf('--base') + 1] !== 'main') process.exit(90);
  if (process.env.FAIL_PR) { console.error('Simulated PR failure'); process.exit(1); }
  console.log('https://github.com/workshop-tests/participant/pull/1');
} else process.exit(91);
`);
  writeFileSync(join(bin, 'ssh'), `#!/usr/bin/env node
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const command = process.argv.at(-1).match(/^(git-upload-pack|git-receive-pack) '([^']+)'$/);
if (!command) process.exit(92);
const [, service, rawRepo] = command;
const repo = rawRepo.startsWith('/') ? rawRepo.slice(1) : rawRepo;
fs.appendFileSync(process.env.TEST_SSH_LOG, JSON.stringify([service, repo]) + '\\n');
const dest = repo === 'workshop-tests/participant.git' ? process.env.TEST_ORIGIN : repo === 'theomonfort/Github-copilot-workshop.git' ? process.env.TEST_SOURCE : null;
if (!dest || (service === 'git-receive-pack' && dest === process.env.TEST_SOURCE)) process.exit(93);
if (service === 'git-receive-pack' && process.env.FAIL_PUSH) { console.error('Simulated push failure'); process.exit(1); }
if (service === 'git-upload-pack' && dest === process.env.TEST_SOURCE && process.env.FAIL_FETCH) process.exit(1);
if (service === 'git-receive-pack' && process.env.RACE_BRANCH) {
  const r = spawnSync('git', ['--git-dir=' + dest, 'update-ref', 'refs/heads/workshop-checkpoint1', process.env.RACE_BRANCH], {stdio: 'inherit'});
  if (r.status) process.exit(r.status);
}
const r = spawnSync('git', [service.replace('git-', ''), dest], {stdio: 'inherit'});
process.exit(r.status ?? 1);
`);
  chmodSync(join(bin, 'gh'), 0o755);
  chmodSync(join(bin, 'ssh'), 0o755);
  function install(where) {
    mkdirSync(join(where, 'scripts'), { recursive: true });
    for (const path of files) copyFileSync(join(project, path), join(where, path));
    for (const path of files.slice(0, 3)) chmodSync(join(where, path), 0o755);
  }
  git(sandbox, 'init', '--bare', origin);
  git(sandbox, 'clone', origin, participant);
  writeFileSync(join(participant, 'starter.txt'), 'participant main\n');
  writeFileSync(join(participant, '.gitignore'), '.env\nlocal-only/\n');
  git(participant, 'add', '.');
  git(participant, 'commit', '-m', 'Participant root');
  git(participant, 'push', 'origin', 'main');
  const initial = git(participant, 'rev-parse', 'HEAD');
  git(participant, 'tag', 'keep-me');
  git(participant, 'push', 'origin', 'keep-me');
  git(participant, 'tag', '-a', 'do-not-push', '-m', 'Local annotation only');
  git(participant, 'config', 'push.followTags', 'true');
  git(sandbox, 'init', '--bare', source);
  git(sandbox, 'init', canonical);
  install(canonical);
  writeFileSync(join(canonical, '.gitignore'), '.env\nlocal-only/\n');
  writeFileSync(join(canonical, 'site.txt'), 'canonical site\n');
  git(canonical, 'add', '.');
  git(canonical, 'commit', '-m', 'Canonical root');
  const stale = git(canonical, 'rev-parse', 'HEAD');
  writeFileSync(join(canonical, 'canonical-current.txt'), 'latest canonical checkpoint\n');
  git(canonical, 'add', '.');
  git(canonical, 'commit', '-m', 'Canonical update');
  const snapshots = [];
  for (const [i, stage] of stages.entries()) {
    if (i) {
      writeFileSync(join(canonical, i === 1 ? 'presentation.txt' : 'e2e.txt'), `${stage}\n`);
      git(canonical, 'add', '.');
      git(canonical, 'commit', '-m', stage);
    }
    snapshots.push(git(canonical, 'rev-parse', 'HEAD'));
    git(canonical, 'push', source, `HEAD:refs/heads/checkpoint/${stage}`);
  }
  let copiedSHA;
  if (copied) {
    git(participant, 'fetch', source, 'refs/heads/checkpoint/01-develop');
    copiedSHA = git(participant, 'commit-tree', git(participant, 'rev-parse', `${stale}^{tree}`), '-m', 'Unrelated copied checkpoint root');
    git(participant, 'push', '--no-follow-tags', 'origin', `${copiedSHA}:refs/heads/checkpoint/01-develop`);
  }
  // The participant's remote main predates these commands: switching removes the executing module.
  git(participant, 'switch', '-c', 'demo');
  install(participant);
  git(participant, 'add', '.');
  git(participant, 'commit', '-m', 'Install entry points on demo branch');
  git(participant, 'remote', 'set-url', 'origin', https
    ? 'https://github.com/workshop-tests/participant.git' : 'git@github.com:workshop-tests/participant.git');
  const calls = () => existsSync(env.TEST_GH_LOG) ? readFileSync(env.TEST_GH_LOG, 'utf8').trim().split('\n').map(JSON.parse) : [];
  const run = (number, extra = {}) => {
    const result = spawnSync(join(participant, `checkpoint${number}`), [], { cwd: sandbox, env: { ...env, ...extra }, encoding: 'utf8', timeout: 30_000 });
    return { status: result.status, output: result.stdout + result.stderr };
  };
  const head = () => git(participant, 'rev-parse', 'HEAD');
  const remoteRef = (ref) => git(sandbox, '--git-dir=' + origin, 'rev-parse', ref);
  const assertStable = () => {
    assert.equal(remoteRef('main'), initial);
    assert.equal(remoteRef('keep-me'), initial);
    assert.equal(spawnSync('git', ['--git-dir=' + origin, 'show-ref', '--verify', '--quiet', 'refs/tags/do-not-push'], { env }).status, 1);
    if (copied) assert.equal(remoteRef('checkpoint/01-develop'), copiedSHA);
    assert.equal(git(participant, 'remote'), 'origin');
    const requests = readFileSync(env.TEST_SSH_LOG, 'utf8').trim().split('\n').map(JSON.parse);
    assert(!requests.some(([service, repo]) => service === 'git-receive-pack' && repo.startsWith('theomonfort/')));
  };
  const issues = () => JSON.parse(readFileSync(env.TEST_ISSUES, 'utf8'));
  const saveIssues = (value) => writeFileSync(env.TEST_ISSUES, JSON.stringify(value));
  const receiptPath = join(participant, '.git', 'workshop-issues', 'github.com-314.json');
  return { sandbox, participant, origin, source, canonical, env, bin, initial, snapshots, copiedSHA, git, run, calls, head, remoteRef, assertStable, issues, saveIssues, receiptPath };
}

function assertPullRequest(f, number, base) {
  const args = f.calls().filter((args) => args[0] === 'pr').at(-1);
  assert.equal(args[args.indexOf('--title') + 1], titles[number - 1]);
  assert.equal(args[args.indexOf('--head') + 1], `workshop-checkpoint${number}`);
  const body = args[args.indexOf('--body') + 1];
  const sections = body.split('<details>');
  assert.equal(sections.length, 2);
  const [visible, details] = sections;
  assert.equal(visible.trim().split('\n\n').length, 5);
  assert.match(visible, /PLAN ハーネス/);
  assert.match(visible, [
    /Playbook の一覧 \/ 詳細を備えた基本サイトの完成例/,
    /一覧 \/ 詳細 \/ プレゼンを備えたサイトの完成例/,
    /2D \/ 3D \/ プレゼン対応サイト、Playwright テスト、PR CI の完成例/,
  ][number - 1]);
  assert.match(visible, /`npm ci` → `npm run dev`/);
  assert.match(visible, /表示 URL（Codespaces は転送 URL）の `\/playbook\/`/);
  assert.match(visible, /全追跡ファイルを置換.*独自変更と削除を確認/);
  assert.match(visible, /意図的な脆弱性と品質問題はサイトから隔離/);
  assert.match(visible, /検出例は `workshop-exercises\/README.md`/);
  assert.match(visible, /必須チェックは回避せず、依存監査の警告とは分けて確認/);
  assert.doesNotMatch(body, /\[x\]|tests passed|checks passed|production-secure|テスト成功|テスト済み|検証済み/i);
  assert.deepEqual([...body.matchAll(/npm run ([a-z0-9:-]+)/g)].map(match => match[1]),
    number === 3 ? ['dev', 'check', 'test:e2e'] : ['dev', 'check', 'build']);
  if (number === 3) {
    assert.match(visible, /2D \/ 3D、詳細、プレゼンを確認/);
    assert.match(details, /npx playwright install chromium/);
    assert.match(details, /Linux: `npx playwright install --with-deps chromium`/);
    assert.match(details, /PR の CI 結果も確認/);
  } else {
    assert.doesNotMatch(visible, /3D/);
    assert.doesNotMatch(body, /playwright|test:e2e/i);
    assert.match(visible, number === 1 ? /一覧と詳細を確認/ : /カードからプレゼンを開き、移動と目次を確認/);
  }
  const checkpoint = `checkpoint/${stages[number - 1]}`;
  const source = 'https://github.com/theomonfort/Github-copilot-workshop.git';
  const snapshot = f.snapshots[number - 1];
  for (const value of [checkpoint, source, snapshot, base]) {
    assert.ok(!visible.includes(value));
    assert.ok(details.includes(value));
  }
  assert.match(details, /<summary>取り込み元と確認コマンド<\/summary>/);
  assert.match(details, /前段の取り込みは不要.*ファイルのみ.*履歴はマージしません/);
  assert.match(details, /別ターミナル.*取り込みスクリプトでは未実行/);
  assert.ok(details.endsWith('</details>'));
  assert.equal(f.git(f.participant, 'log', '-1', '--format=%s'), `Import workshop ${checkpoint}`);
  assert.equal(f.git(f.participant, 'log', '-1', '--format=%b'),
    `Import files from ${source} at ${snapshot} (${checkpoint}). Based on participant main ${base}; canonical history is not merged. Review this snapshot before merging.`);
}

test('main-only HTTPS/SSH origins: exact snapshots on participant history, despite replacing running files', (t) => {
  const f = fixture(t, { https: true });
  const result = f.run(1);
  assert.equal(result.status, 0, result.output);
  assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
  assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^{tree}'), f.git(f.canonical, 'rev-parse', `${f.snapshots[0]}^{tree}`));
  assert.equal(f.remoteRef('workshop-checkpoint1'), f.head());
  assert.equal(f.calls().filter((args) => args[0] === 'pr').length, 1);
  for (const path of files.slice(0, 3)) assert.match(f.git(f.participant, 'ls-tree', 'HEAD', path), /^100755 /);
  f.git(f.participant, 'remote', 'set-url', 'origin', 'ssh://git@github.com/workshop-tests/participant.git');
  const ssh = f.run(2);
  assert.equal(ssh.status, 0, ssh.output);
  assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
  f.assertStable();
});

test('copied unrelated branch is untouched; use the current canonical snapshot, not its stale copy', (t) => {
  const f = fixture(t, { copied: true });
  assert.equal(spawnSync('git', ['merge-base', f.initial, f.copiedSHA], { cwd: f.participant, env: f.env }).status, 1);
  const result = f.run(1);
  assert.equal(result.status, 0, result.output);
  assert(existsSync(join(f.participant, 'canonical-current.txt')));
  assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
  f.assertStable();
});

test('preserves staged, unstaged, untracked and non-colliding ignored work without committing it', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.participant, 'starter.txt'), 'staged demo');
  f.git(f.participant, 'add', 'starter.txt');
  writeFileSync(join(f.participant, 'starter.txt'), 'unstaged demo');
  writeFileSync(join(f.participant, 'notes with space.txt'), 'untracked demo');
  writeFileSync(join(f.participant, '.env'), 'local secret, never commit');
  const result = f.run(1);
  assert.equal(result.status, 0, result.output);
  const stash = f.git(f.participant, 'rev-parse', 'refs/stash');
  assert(result.output.includes(stash));
  assert.equal(f.git(f.participant, 'show', `${stash}^2:starter.txt`), 'staged demo');
  assert.equal(f.git(f.participant, 'show', `${stash}:starter.txt`), 'unstaged demo');
  assert.equal(f.git(f.participant, 'show', `${stash}^3:notes with space.txt`), 'untracked demo');
  assert.equal(f.git(f.participant, 'ls-tree', 'HEAD', '--', 'starter.txt', 'notes with space.txt', '.env'), '');
  assert.equal(readFileSync(join(f.participant, '.env'), 'utf8'), 'local secret, never commit');
  assert.match(result.output, /git switch 'demo'/);
  f.assertStable();
});

test('sequential imports preserve titles/commits and provide useful stage-specific PR descriptions; a matching snapshot is a no-op', (t) => {
  const f = fixture(t);
  let previous = f.initial;
  for (const number of [1, 2, 3]) {
    const result = f.run(number);
    assert.equal(result.status, 0, result.output);
    assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), previous);
    const prs = f.calls().filter((args) => args[0] === 'pr');
    assert.equal(prs.length, number);
    assertPullRequest(f, number, previous);
    previous = f.head();
    f.git(f.sandbox, '--git-dir=' + f.origin, 'update-ref', 'refs/heads/main', previous);
  }
  writeFileSync(join(f.participant, 'site.txt'), 'unfinished live demo');
  writeFileSync(join(f.participant, 'untracked.txt'), 'keep this');
  const before = f.git(f.participant, 'status', '--porcelain');
  const result = f.run(3);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /already matches/);
  assert.equal(f.git(f.participant, 'status', '--porcelain'), before);
  assert.equal(f.head(), previous);
  assert.equal(f.calls().filter((args) => args[0] === 'pr').length, 3);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
});

test('later checkpoints describe the complete snapshot when imported without merging earlier stages', (t) => {
  const f = fixture(t);
  for (const number of [2, 3]) {
    const result = f.run(number, { ISSUES_DISABLED: '1', FAIL_ISSUE_READ: '1', FAIL_ISSUE_CREATE: '1' });
    assert.equal(result.status, 0, result.output);
    assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
    assertPullRequest(f, number, f.initial);
    f.assertStable();
  }
  assert.equal(f.issues().length, 0);
  assert(!f.calls().some((args) => args.some((arg) => arg.includes('/issues'))));
  assert(!existsSync(f.receiptPath));
});

test('existing local/remote work branches and repeated invocations get fresh branch names', (t) => {
  const f = fixture(t);
  f.git(f.participant, 'branch', 'workshop-checkpoint1');
  const existing = f.head();
  f.git(f.sandbox, '--git-dir=' + f.origin, 'update-ref', 'refs/heads/workshop-checkpoint1-2', f.initial);
  for (const suffix of [3, 4]) {
    const result = f.run(1);
    assert.equal(result.status, 0, result.output);
    assert.equal(f.git(f.participant, 'branch', '--show-current'), `workshop-checkpoint1-${suffix}`);
    assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
  }
  assert.equal(f.git(f.participant, 'rev-parse', 'workshop-checkpoint1'), existing);
  assert.equal(f.remoteRef('workshop-checkpoint1-2'), f.initial);
  assert.equal(f.issues().length, catalogue.length);
  f.git(f.participant, 'branch', 'workshop-checkpoint2/topic');
  f.git(f.sandbox, '--git-dir=' + f.origin, 'update-ref', 'refs/heads/WORKSHOP-CHECKPOINT2-2', f.initial);
  const nested = f.run(2);
  assert.equal(nested.status, 0, nested.output);
  assert.equal(f.git(f.participant, 'branch', '--show-current'), 'workshop-checkpoint2-3');
  f.assertStable();
});

test('canonical origin, alternate push destination, and redirected canonical repository are refused', (t) => {
  const f = fixture(t);
  const before = f.head();
  f.git(f.participant, 'remote', 'set-url', 'origin', 'https://github.com/theomonfort/Github-copilot-workshop.git');
  assert.match(f.run(1).output, /not the canonical workshop/);
  f.git(f.participant, 'remote', 'set-url', 'origin', 'ssh://git@github.com/workshop-tests/participant.git');
  f.git(f.participant, 'remote', 'set-url', '--push', 'origin', 'git@github.com:theomonfort/Github-copilot-workshop.git');
  assert.match(f.run(1).output, /not the canonical workshop/);
  f.git(f.participant, 'config', '--unset', 'remote.origin.pushurl');
  assert.match(f.run(1, { REDIRECT_SOURCE: '1' }).output, /not the canonical workshop/);
  assert.equal(f.head(), before);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  assert(!f.calls().some((args) => args[0] === 'pr'));
  assert.equal(f.issues().length, 0);
});

test('missing Node/git/gh, missing authentication and push permission stop before saving work', (t) => {
  const f = fixture(t);
  const before = f.head();
  writeFileSync(join(f.participant, 'notes.txt'), 'not stashed on prerequisite failure');
  const empty = join(f.sandbox, 'empty-bin');
  mkdirSync(empty);
  assert.match(f.run(1, { PATH: empty }).output, /Node.js/);
  symlinkSync(process.execPath, join(empty, 'node'));
  symlinkSync('/usr/bin/dirname', join(empty, 'dirname'));
  assert.match(f.run(1, { PATH: empty }).output, /git:.*ENOENT/);
  const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  symlinkSync(realGit, join(empty, 'git'));
  assert.match(f.run(1, { PATH: empty }).output, /gh:.*ENOENT/);
  assert.notEqual(f.run(1, { FAIL_AUTH: '1' }).status, 0);
  assert.match(f.run(1, { NO_PUSH: '1' }).output, /needs push access/);
  assert.equal(f.head(), before);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  assert(existsSync(join(f.participant, 'notes.txt')));
  f.git(f.sandbox, '--git-dir=' + f.origin, 'update-ref', '-d', 'refs/heads/main');
  assert.match(f.run(1).output, /Stopped while fetching participant main/);
  assert.equal(f.head(), before);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
});

test('ignored collisions and in-progress Git operations stop without discarding files', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.participant, '.gitignore'), '.env\nsite.txt\n');
  writeFileSync(join(f.participant, 'site.txt'), 'ignored work');
  const before = f.head();
  const result = f.run(1);
  assert.notEqual(result.status, 0, result.output);
  assert.match(result.output, /Ignored files would be replaced/);
  assert.equal(readFileSync(join(f.participant, 'site.txt'), 'utf8'), 'ignored work');
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  assert.equal(f.issues().length, 0);
  writeFileSync(join(f.participant, '.git', 'MERGE_HEAD'), f.initial + '\n');
  assert.match(f.run(1).output, /Finish the existing Git operation/);
  assert.equal(f.head(), before);
});

test('checkpoint1 prepares the exact current Japanese catalogue before Git writes, independent of local edits', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.participant, 'scripts/checkpoint-issues.json'), 'unfinished local catalogue');
  const result = f.run(1);
  assert.equal(result.status, 0, result.output);
  assert.equal(catalogue.length, 8);
  assert.deepEqual(catalogue.map((item) => item.key), [
    'presentation-core', 'presentation-content', 'mermaid-rendering', 'responsive-navigation',
    'presentation-tests', 'playbook-3d', 'galaxy-audio', 'daily-repo-status',
  ]);
  assert.deepEqual(f.issues().map(({ title, body }) => ({ title, body })),
    catalogue.map(({ title, body }) => ({ title, body })));
  const receipt = JSON.parse(readFileSync(f.receiptPath, 'utf8'));
  for (const [index, item] of catalogue.entries()) {
    assert.equal(receipt.issues[item.key], f.issues()[index].number);
    assert(result.output.includes(f.issues()[index].html_url));
  }
  assert(result.output.indexOf('Workshop issues ready: 8 created') < result.output.indexOf('Saved tracked'));
  assert.equal(f.git(f.participant, 'show', 'refs/stash:scripts/checkpoint-issues.json'), 'unfinished local catalogue');
  assert.equal(f.git(f.participant, 'ls-tree', 'HEAD', '--', '.git/workshop-issues'), '');
  assertPullRequest(f, 1, f.initial);
  assert(!existsSync(`${f.receiptPath}.lock`));
  assert(!existsSync(`${f.receiptPath}.tmp`));
  f.assertStable();
});

test('reruns preserve edited/closed issues and recover marker-free identities from receipts without duplicates', (t) => {
  const f = fixture(t);
  const first = f.run(1);
  assert.equal(first.status, 0, first.output);
  f.git(f.sandbox, '--git-dir=' + f.origin, 'update-ref', 'refs/heads/main', f.head());
  const issues = f.issues();
  issues[0].title = 'My edited title';
  issues[0].body = 'My edited body without markers';
  issues[1].state = 'closed';
  issues[1].title = 'Closed and edited title';
  issues[2].body = 'Only the title key remains';
  const receipt = JSON.parse(readFileSync(f.receiptPath, 'utf8'));
  delete receipt.issues[catalogue[2].key];
  writeFileSync(f.receiptPath, JSON.stringify(receipt));
  issues.push({ ...issues[3], number: 123, pull_request: {}, title: catalogue[0].title, body: catalogue[0].body });
  f.saveIssues(issues);
  writeFileSync(join(f.participant, 'site.txt'), 'unfinished site work');
  writeFileSync(join(f.participant, 'notes.txt'), 'untracked notes');
  const before = f.git(f.participant, 'status', '--porcelain');
  const head = f.head();
  const result = f.run(1);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /0 created, 8 reused/);
  assert.match(result.output, /already matches/);
  assert.deepEqual(f.issues(), issues);
  assert.equal(f.calls().filter((args) => args.includes('POST')).length, 8);
  assert.equal(f.calls().filter((args) => args[0] === 'pr').length, 1);
  assert.equal(f.git(f.participant, 'status', '--porcelain'), before);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  assert.equal(f.head(), head);
});

test('an already-imported main still prepares missing issues and reuses paginated existing closed issues', (t) => {
  const f = fixture(t);
  f.git(f.participant, 'fetch', f.source, 'refs/heads/checkpoint/01-develop');
  const imported = f.git(f.participant, 'commit-tree', `${f.snapshots[0]}^{tree}`, '-p', f.initial, '-m', 'Already imported');
  f.git(f.participant, 'push', '--no-follow-tags', 'origin', `${imported}:refs/heads/main`);
  const existing = catalogue.slice(0, 3).map((item, index) => ({
    number: 140 + index, title: 'User title', body: `${item.body}\nUser notes`, state: 'closed',
    html_url: `https://github.com/workshop-tests/participant/issues/${140 + index}`,
  }));
  f.saveIssues(existing);
  writeFileSync(join(f.participant, 'notes.txt'), 'keep local work');
  const before = f.git(f.participant, 'status', '--porcelain');
  const head = f.head();
  const result = f.run(1);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /5 created, 3 reused/);
  assert.match(result.output, /already matches/);
  assert.deepEqual(f.issues().slice(0, 3), existing);
  assert.equal(f.issues().length, 8);
  assert.equal(f.head(), head);
  assert.equal(f.remoteRef('main'), imported);
  assert.equal(f.git(f.participant, 'status', '--porcelain'), before);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  assert(!f.calls().some((args) => args[0] === 'pr'));
});

test('disabled issues and missing issue permissions stop before stashing or publishing', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.participant, 'notes.txt'), 'leave untouched');
  const head = f.head();
  for (const extra of [{ ISSUES_DISABLED: '1' }, { FAIL_ISSUE_READ: '1' }, { FAIL_ISSUE_CREATE: '1' }]) {
    const result = f.run(1, extra);
    assert.notEqual(result.status, 0, result.output);
    assert.match(result.output, /Issues enabled|issue read permission failure|issue create permission failure/);
    assert.equal(f.head(), head);
    assert.equal(f.git(f.participant, 'stash', 'list'), '');
    assert.equal(readFileSync(join(f.participant, 'notes.txt'), 'utf8'), 'leave untouched');
    assert.equal(f.issues().length, 0);
    assert(!f.calls().some((args) => args[0] === 'pr'));
    assert(!existsSync(`${f.receiptPath}.lock`));
  }
  f.assertStable();
});

test('partial issue failures and lost creation responses resume without duplicate issues or checkout changes', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.participant, 'notes.txt'), 'keep until successful issue preparation');
  const head = f.head();
  const failed = f.run(1, { FAIL_ISSUE_KEY: 'mermaid-rendering' });
  assert.notEqual(failed.status, 0);
  assert.equal(f.issues().length, 2);
  assert.match(failed.output, /Created issue presentation-core: #43/);
  assert.match(failed.output, /rerun \.\/checkpoint1/);
  assert.equal(f.head(), head);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  const lost = f.run(1, { LOSE_ISSUE_RESPONSE_KEY: 'mermaid-rendering' });
  assert.notEqual(lost.status, 0);
  assert.equal(f.issues().length, 3);
  assert.match(lost.output, /request may have succeeded/);
  assert.equal(f.head(), head);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  const completed = f.run(1);
  assert.equal(completed.status, 0, completed.output);
  assert.match(completed.output, /5 created, 3 reused/);
  assert.equal(f.issues().length, 8);
  assert.deepEqual(f.issues().map((issue) => issue.title), catalogue.map((item) => item.title));
  assert.equal(f.calls().filter((args) => args[0] === 'pr').length, 1);
  assert.equal(f.git(f.participant, 'show', 'refs/stash^3:notes.txt'), 'keep until successful issue preparation');
  assert(!existsSync(`${f.receiptPath}.lock`));
  assert(!existsSync(`${f.receiptPath}.tmp`));
  f.assertStable();
});

test('ambiguous identities, missing recorded issues and existing locks never trigger replacement creation', (t) => {
  const f = fixture(t);
  const matching = [71, 72].map((number) => ({
    number, title: catalogue[0].title, body: catalogue[0].body, state: 'open',
    html_url: `https://github.com/workshop-tests/participant/issues/${number}`,
  }));
  f.saveIssues(matching);
  const duplicate = f.run(1);
  assert.notEqual(duplicate.status, 0);
  assert.match(duplicate.output, /Multiple issues match presentation-core: #71, #72/);
  f.saveIssues([{ ...matching[0], body: catalogue[0].body + catalogue[1].body }]);
  const conflicting = f.run(1);
  assert.notEqual(conflicting.status, 0);
  assert.match(conflicting.output, /matches multiple catalogue keys/);
  writeFileSync(f.receiptPath, JSON.stringify({ version: 1, issues: { 'presentation-core': 73 } }));
  f.saveIssues([]);
  const missing = f.run(1);
  assert.notEqual(missing.status, 0);
  assert.match(missing.output, /Recorded issue #73.*missing or transferred/);
  writeFileSync(`${f.receiptPath}.lock`, 'other-process\n');
  const locked = f.run(1);
  assert.notEqual(locked.status, 0);
  assert.match(locked.output, /Issue preparation is locked/);
  assert.equal(readFileSync(`${f.receiptPath}.lock`, 'utf8'), 'other-process\n');
  assert(!f.calls().some((args) => args.includes('POST') || args[0] === 'pr'));
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  f.assertStable();
});

test('invalid local receipts and canonical catalogue data stop explicitly without remote mutations', (t) => {
  const f = fixture(t);
  mkdirSync(dirname(f.receiptPath), { recursive: true });
  for (const invalid of ['{', '{"version":1,"issues":{"presentation-core":"not-a-number"}}']) {
    writeFileSync(f.receiptPath, invalid);
    const result = f.run(1);
    assert.notEqual(result.status, 0);
    assert(result.output.includes(f.receiptPath));
    assert.equal(readFileSync(f.receiptPath, 'utf8'), invalid);
    assert(!existsSync(`${f.receiptPath}.lock`));
  }
  writeFileSync(f.receiptPath, '{"version":1,"issues":{}}');
  writeFileSync(join(f.canonical, 'scripts/checkpoint-issues.json'), JSON.stringify([{ ...catalogue[0], body: 'Missing identity marker' }]));
  f.git(f.canonical, 'commit', '-am', 'Invalid fixture catalogue');
  f.git(f.canonical, 'push', f.source, 'HEAD:refs/heads/checkpoint/01-develop');
  const invalid = f.run(1);
  assert.notEqual(invalid.status, 0);
  assert.match(invalid.output, /canonical issue catalogue is invalid/);
  assert(!f.calls().some((args) => args.includes('POST') || args[0] === 'pr'));
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  f.assertStable();
});

test('fetch failure leaves the checkout unchanged; push/PR failures retain recoverable commits and stash', (t) => {
  const f = fixture(t);
  const before = f.head();
  writeFileSync(join(f.participant, 'notes.txt'), 'recover me');
  const fetch = f.run(1, { FAIL_FETCH: '1' });
  assert.notEqual(fetch.status, 0);
  assert.equal(f.head(), before);
  assert.equal(f.git(f.participant, 'stash', 'list'), '');
  const push = f.run(1, { FAIL_PUSH: '1' });
  assert.notEqual(push.status, 0);
  assert.match(push.output, /retry the create-only push/);
  assert.match(push.output, /git stash apply --index/);
  assert.match(push.output, /'--title' 'Website scaffold' '--body' 'PLAN ハーネス/);
  assert.match(push.output, /<summary>取り込み元と確認コマンド<\/summary>/);
  assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
  assert(!f.calls().some((args) => args[0] === 'pr'));
  const pr = f.run(2, { FAIL_PR: '1' });
  assert.notEqual(pr.status, 0);
  assert.match(pr.output, /Check for an existing PR before retrying/);
  assert.match(pr.output, /'--title' 'Website with presentation mode' '--body' 'PLAN ハーネス/);
  assertPullRequest(f, 2, f.initial);
  assert.equal(f.remoteRef('workshop-checkpoint2'), f.head());
  assert.equal(f.git(f.participant, 'show', 'refs/stash^3:notes.txt'), 'recover me');
  f.assertStable();
});

test('create-only lease rejects a branch created between collision checks and push', (t) => {
  const f = fixture(t);
  const result = f.run(1, { RACE_BRANCH: f.initial });
  assert.notEqual(result.status, 0, result.output);
  assert.equal(f.remoteRef('workshop-checkpoint1'), f.initial);
  assert(!f.calls().some((args) => args[0] === 'pr'));
  assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
  f.assertStable();
});

test('commit failure retains the imported index and original stash, without pushing or creating a PR', (t) => {
  const f = fixture(t);
  writeFileSync(join(f.participant, 'notes.txt'), 'saved before failed commit');
  const hook = join(f.participant, '.git', 'hooks', 'pre-commit');
  writeFileSync(hook, '#!/bin/sh\necho "Simulated commit failure" >&2\nexit 1\n');
  chmodSync(hook, 0o755);
  const result = f.run(1);
  assert.notEqual(result.status, 0);
  assert.match(result.output, /Stopped while committing the snapshot/);
  assert.equal(f.head(), f.initial);
  assert.equal(f.git(f.participant, 'write-tree'), f.git(f.canonical, 'rev-parse', `${f.snapshots[0]}^{tree}`));
  assert.equal(f.git(f.participant, 'show', 'refs/stash^3:notes.txt'), 'saved before failed commit');
  assert(!f.calls().some((args) => args[0] === 'pr'));
  f.assertStable();
});
