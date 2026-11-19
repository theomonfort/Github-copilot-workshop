import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, realpathSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const source = 'https://github.com/theomonfort/Github-copilot-workshop.git';
export const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
export const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

export function createContext(root) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' };
  const run = (command, args, accepted = [0]) => {
    const result = spawnSync(command, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (result.error) throw new Error(`${command}: ${result.error.message}`);
    if (!accepted.includes(result.status)) {
      throw new Error(`${command} failed (${result.status}): ${(result.stderr || result.stdout).trim()}`);
    }
    return { text: result.stdout.trim(), stdout: result.stdout, status: result.status };
  };
  const git = (args, accepted) => run('git', args, accepted);
  const fetch = (remote, ref) => {
    git(['fetch', '--no-tags', '--no-prune', '--no-recurse-submodules', '--refmap=', remote, ref]);
    return git(['rev-parse', 'FETCH_HEAD^{commit}']).text;
  };
  return { root, run, git, fetch };
}

export function repository(remote) {
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

export function preflight({ root, git, run }) {
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
  requireThat(repository(metadata.clone_url).key === target.key, 'origin resolves to a different repository; update origin explicitly first.');
  requireThat(metadata.permissions?.push === true && !metadata.archived && !metadata.disabled,
    'Your gh account needs push access to an active participant repository.');
  requireThat(Number.isSafeInteger(metadata.id) && metadata.id > 0, 'Cannot identify the participant repository.');
  return { target, metadata };
}

export function operationLock({ root, git }, target, metadata) {
  const directory = resolve(root, git(['rev-parse', '--git-common-dir']).text, 'workshop-operations');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${encodeURIComponent(target.host.toLowerCase())}-${metadata.id}.lock`);
  let lock;
  try { lock = openSync(path, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Workshop command is locked: ${path}. Confirm the recorded process has stopped before removing a stale lock.`);
    throw error;
  }
  try { writeFileSync(lock, `${process.pid}\n`); }
  catch (error) { closeSync(lock); unlinkSync(path); throw error; }
  return () => { closeSync(lock); unlinkSync(path); };
}

export function preserveIgnoredFiles({ root, git }, ...snapshots) {
  const paths = new Set();
  for (const sha of snapshots) {
    for (const entry of git(['ls-tree', '-rz', sha]).text.split('\0').filter(Boolean)) {
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
