import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['checkpoint1', 'checkpoint2', 'checkpoint3', 'scripts/checkpoint.mjs'];
const stages = ['01-develop', '02-cloud-agent', '03-tests'];

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
  };
  function git(cwd, ...args) {
    const result = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`);
    return result.stdout.trim();
  }
  git(sandbox, 'config', '--global', 'url.git@github.com:.insteadOf', 'https://github.com/');
  git(sandbox, 'config', '--global', 'init.defaultBranch', 'main');
  git(sandbox, 'config', '--global', 'commit.gpgsign', 'false');
  writeFileSync(join(bin, 'gh'), `#!/usr/bin/env node
const fs = require('node:fs');
const a = process.argv.slice(2);
fs.appendFileSync(process.env.TEST_GH_LOG, JSON.stringify(a) + '\\n');
if (a[0] === 'auth') process.exit(process.env.FAIL_AUTH ? 1 : 0);
if (a[0] === 'api') {
  console.log(JSON.stringify({clone_url: 'https://github.com/' + (process.env.REDIRECT_SOURCE ? 'theomonfort/Github-copilot-workshop' : 'workshop-tests/participant') + '.git', permissions: {push: !process.env.NO_PUSH}, archived: false}));
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
  return { sandbox, participant, origin, source, canonical, env, bin, initial, snapshots, copiedSHA, git, run, calls, head, remoteRef, assertStable };
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

test('sequential imports use newly fetched main; already-present snapshot is a clean no-op', (t) => {
  const f = fixture(t);
  let previous = f.initial;
  for (const number of [1, 2, 3]) {
    const result = f.run(number);
    assert.equal(result.status, 0, result.output);
    assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), previous);
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
  writeFileSync(join(f.participant, '.git', 'MERGE_HEAD'), f.initial + '\n');
  assert.match(f.run(1).output, /Finish the existing Git operation/);
  assert.equal(f.head(), before);
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
  assert.equal(f.git(f.participant, 'rev-parse', 'HEAD^'), f.initial);
  assert(!f.calls().some((args) => args[0] === 'pr'));
  const pr = f.run(2, { FAIL_PR: '1' });
  assert.notEqual(pr.status, 0);
  assert.match(pr.output, /Check for an existing PR before retrying/);
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
