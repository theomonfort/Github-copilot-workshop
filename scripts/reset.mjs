import { createInterface } from 'node:readline/promises';
import { existsSync, mkdirSync, openSync, closeSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, operationLock, preflight, preserveIgnoredFiles, quote, requireThat, source } from './checkpoint-common.mjs';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const context = createContext(root);
const { git, run, fetch } = context;
const state = { completed: [] };
const done = (text) => { state.completed.push(text); console.log(text); };
const skip = (text) => console.log(`保持 / Skip: ${text}`);
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40,64}$/.test(value);
const number = (value) => Number.isSafeInteger(value) && value > 0;
const checkpointBranch = (name) => /^workshop-checkpoint[123](?:-[2-9]\d*|-1\d+)?$/.test(name);
const resetBranch = (name) => /^workshop-reset(?:-[2-9]\d*|-1\d+)?$/.test(name);
const resetMessage = (snapshot, base) => `Reset workshop to starter\n\nRestore files from ${source} at ${snapshot} (main). Based on participant main ${base}; canonical history is not merged. Review this snapshot before merging.`;
const marker = (snapshot, base) => `<!-- workshop-reset:v1 snapshot=${snapshot} base=${base} -->`;
const tree = (commit) => git(['rev-parse', `${commit}^{tree}`]).text;
const heads = () => new Map(git(['ls-remote', '--heads', 'origin']).text.split('\n').filter(Boolean)
  .map((line) => { const [hash, ref] = line.split('\t'); return [ref.slice('refs/heads/'.length), hash]; }));
const worktreeBranches = () => new Set(git(['worktree', 'list', '--porcelain']).text.split('\n')
  .filter((part) => part.startsWith('branch refs/heads/')).map((part) => part.slice('branch refs/heads/'.length)));

async function main() {
  requireThat(process.argv.length === 2, 'Use ./reset without options. Confirmation cannot be bypassed.');
  const { target, metadata } = preflight(context);
  state.release = operationLock(context, target, metadata);
  state.target = target;
  const endpoint = `repos/${target.path}`;
  const api = (path, ...args) => JSON.parse(run('gh', ['api', '--hostname', target.host, `${endpoint}${path}`, ...args]).text);
  const list = (kind) => {
    const pages = api(`/${kind}?state=all&per_page=100&sort=created&direction=asc`, '--paginate', '--slurp');
    requireThat(Array.isArray(pages) && pages.every(Array.isArray), `Invalid ${kind} listing; no cleanup was attempted.`);
    return [...new Map(pages.flat().map((item) => [item.number, item])).values()];
  };
  const identity = (item, kind) => {
    if (!number(item?.number) || !number(item?.id) || typeof item.html_url !== 'string') return false;
    const expected = `https://${target.host}/${target.path}/${kind}/${item.number}`.toLowerCase();
    return item.html_url.toLowerCase() === expected;
  };
  const sameRepoPR = (pr) => identity(pr, 'pull') && pr.head?.repo?.id === metadata.id
    && pr.base?.repo?.id === metadata.id && pr.base.ref === 'main' && sha(pr.head.sha);
  const base = fetch('origin', 'refs/heads/main');
  const snapshot = fetch(source, 'refs/heads/main');
  const snapshotTree = tree(snapshot);
  for (const path of ['reset', 'checkpoint1', 'checkpoint2', 'checkpoint3', 'scripts/reset.mjs', 'scripts/checkpoint-common.mjs', 'scripts/checkpoint.mjs', 'scripts/checkpoint-issues.mjs', 'scripts/checkpoint-issues.json']) {
    requireThat(git(['ls-tree', snapshot, '--', path]).text.startsWith(path.includes('/') ? '100644 blob ' : '100755 blob '),
      `Canonical main lacks a usable ${path}. Nothing was reset.`);
  }
  const originalHead = git(['rev-parse', 'HEAD']).text;
  const original = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1]).text;
  const directory = resolve(root, git(['rev-parse', '--git-common-dir']).text);
  const journalPath = join(directory, 'workshop-resets', `${encodeURIComponent(target.host.toLowerCase())}-${metadata.id}.json`);
  const journal = existsSync(journalPath) ? JSON.parse(readFileSync(journalPath, 'utf8')) : null;
  if (journal) requireThat(journal.version === 1 && journal.repo === target.key && journal.repoId === metadata.id
    && resetBranch(journal.branch) && [journal.base, journal.snapshot, journal.commit, journal.originalHead].every(sha)
    && typeof journal.original === 'string' && (!journal.stash || sha(journal.stash)), `Invalid reset journal: ${journalPath}. Inspect it; do not discard recovery records.`);
  const save = (record) => {
    mkdirSync(dirname(journalPath), { recursive: true, mode: 0o700 });
    const temporary = `${journalPath}.tmp`;
    const file = openSync(temporary, 'wx', 0o600);
    try {
      try { writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`); }
      finally { closeSync(file); }
      renameSync(temporary, journalPath);
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  };
  const sourceCommits = new Set([snapshot]);
  const proofs = new Map();
  const proof = (commit) => {
    if (proofs.has(commit)) return proofs.get(commit);
    const message = git(['show', '-s', '--format=%B', commit]).text;
    const match = message.match(/^(Import workshop checkpoint\/(01-develop|02-cloud-agent|03-tests)|Reset workshop to starter)\n\n(?:Import|Restore) files from (\S+) at ([a-f0-9]{40,64}) \(([^)]+)\)\. Based on participant main ([a-f0-9]{40,64});/);
    let result = null;
    if (match && match[3] === source) {
      const [, subject, stage, , recordedSnapshot, ref, recordedBase] = match;
      const kind = stage ? 'checkpoint' : 'reset';
      const expected = stage
        ? `${subject}\n\nImport files from ${source} at ${recordedSnapshot} (checkpoint/${stage}). Based on participant main ${recordedBase}; canonical history is not merged. Review this snapshot before merging.`
        : resetMessage(recordedSnapshot, recordedBase);
      if (message === expected && ref === (stage ? `checkpoint/${stage}` : 'main')) {
        if (!sourceCommits.has(recordedSnapshot)) {
          try { requireThat(fetch(source, recordedSnapshot) === recordedSnapshot, 'Canonical SHA mismatch.'); sourceCommits.add(recordedSnapshot); }
          catch (error) { skip(`${commit}: 元 snapshot を確認できません (${error.message})`); }
        }
        if (sourceCommits.has(recordedSnapshot) && tree(commit) === tree(recordedSnapshot)
          && git(['show', '-s', '--format=%P', commit]).text === recordedBase) {
          result = { kind, snapshot: recordedSnapshot, base: recordedBase, ref, commit };
        }
      }
    }
    proofs.set(commit, result);
    return result;
  };
  const remote = heads();
  const branchProofs = new Map();
  for (const [name, hash] of remote) {
    if (!checkpointBranch(name) && !resetBranch(name)) continue;
    const actual = fetch('origin', `refs/heads/${name}`);
    if (actual !== hash) { skip(`${JSON.stringify(name)}: 確認中に変更されました`); continue; }
    const owned = proof(hash);
    if (owned && (owned.kind === 'reset' ? resetBranch(name) : checkpointBranch(name))) branchProofs.set(name, owned);
    else skip(`${JSON.stringify(name)}: 名前だけでは所有元を確認できません`);
  }
  const pulls = list('pulls');
  const closePRs = [], resetPRs = [];
  for (const pr of pulls) {
    const relevant = typeof pr.body === 'string' && pr.body.includes(source);
    if (!sameRepoPR(pr) || !relevant) {
      if (pr.state === 'open' && (checkpointBranch(pr.head?.ref ?? '') || resetBranch(pr.head?.ref ?? ''))) skip(`PR #${pr.number}: 別 repo / base または provenance 不足`);
      continue;
    }
    if (fetch('origin', `refs/pull/${pr.number}/head`) !== pr.head.sha) {
      skip(`PR #${pr.number}: 確認中に head が変更されました`); continue;
    }
    const owned = proof(pr.head.sha);
    const body = pr.body;
    if (!owned || !body.includes(owned.snapshot) || !body.includes(owned.base)) {
      if (pr.state === 'open') skip(`PR #${pr.number}: snapshot / parent / 本文を確認できません`);
      continue;
    }
    if (owned.kind === 'checkpoint' && body.includes(owned.ref) && pr.state === 'open') closePRs.push(pr);
    if (owned.kind === 'reset' && body.includes(marker(owned.snapshot, owned.base))) resetPRs.push({ pr, ...owned });
  }
  const alreadyStarter = tree(base) === snapshotTree;
  const unverifiedReset = pulls.find((pr) => pr.state === 'open' && pr.head?.repo?.id === metadata.id
    && (resetBranch(pr.head.ref) || pr.body?.includes('<!-- workshop-reset:'))
    && !resetPRs.some((item) => item.pr.id === pr.id));
  requireThat(!unverifiedReset, `Potential reset PR ${unverifiedReset?.html_url} has changed or lacks proof. Inspect it before retrying; no duplicate was created.`);
  const openResets = resetPRs.filter(({ pr }) => pr.state === 'open');
  requireThat(openResets.length <= 1, 'Multiple reset PRs exist. Inspect them before retrying.');
  const existing = openResets[0];
  if (existing) requireThat(existing.base === base && existing.snapshot === snapshot,
    `Reset PR ${existing.pr.html_url} targets an older main/snapshot. Review or close it before retrying; it was not overwritten.`);
  if (!alreadyStarter && !existing) {
    const closed = resetPRs.find((item) => item.base === base && item.snapshot === snapshot && item.pr.state === 'closed' && !item.pr.merged_at);
    requireThat(!closed, `Reset PR ${closed?.pr.html_url} was closed without merging. Reopen it manually if desired; no duplicate was created.`);
  }
  const candidates = [...branchProofs].filter(([name, item]) => resetBranch(name) && item.kind === 'reset' && item.base === base && item.snapshot === snapshot);
  requireThat(candidates.length <= 1 || alreadyStarter || existing, 'Multiple unmerged reset branches exist. Inspect them before retrying.');
  let record;
  if (!alreadyStarter && !existing) {
    if (journal && !resetPRs.some(({ pr, commit }) => commit === journal.commit && pr.merged_at)) {
      requireThat(journal.base === base && journal.snapshot === snapshot,
        `Pending reset differs from current main: ${journalPath}. Finish or inspect that reset before starting another.`);
      const recordedProof = proof(journal.commit);
      requireThat(recordedProof?.kind === 'reset' && recordedProof.base === base && recordedProof.snapshot === snapshot && tree(journal.commit) === snapshotTree,
        'The recorded reset commit changed or is unavailable. Inspect the journal.');
      record = journal;
    } else if (candidates.length) {
      const [branch, item] = candidates[0];
      record = { version: 1, repo: target.key, repoId: metadata.id, branch, snapshot, base, commit: item.commit, original, originalHead };
    }
  }
  const local = new Map(git(['for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads']).text.split('\n').filter(Boolean)
    .map((line) => line.split('\t')));
  let branch = record?.branch;
  if (!alreadyStarter && !existing && !branch) {
    const taken = [...local.keys(), ...remote.keys()].map((name) => name.toLowerCase());
    branch = 'workshop-reset';
    for (let i = 2; taken.some((name) => name === branch || name.startsWith(`${branch}/`)); i++) branch = `workshop-reset-${i}`;
  }
  if (record) {
    requireThat(!remote.has(branch) || remote.get(branch) === record.commit, `Reset branch ${branch} changed remotely; keep it and inspect ${journalPath}.`);
    requireThat(!local.has(branch) || local.get(branch) === record.commit, `Reset branch ${branch} changed locally; keep it and inspect ${journalPath}.`);
  }
  const catalogue = JSON.parse(git(['show', `${snapshot}:scripts/checkpoint-issues.json`]).text);
  requireThat(Array.isArray(catalogue) && catalogue.every((item) => typeof item.key === 'string'), 'Invalid canonical issue catalogue.');
  const keys = new Set(catalogue.map((item) => item.key));
  const receiptPath = join(directory, 'workshop-issues', `${encodeURIComponent(target.host.toLowerCase())}-${metadata.id}.json`);
  const receipt = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, 'utf8')) : null;
  if (receipt) requireThat(receipt.version === 1 && receipt.issues && typeof receipt.issues === 'object'
    && !Array.isArray(receipt.issues) && Object.values(receipt.issues).every(number)
    && (!receipt.created || (typeof receipt.created === 'object' && !Array.isArray(receipt.created)
      && Object.values(receipt.created).every((item) => number(item?.id) && number(item?.number)))), `Invalid issue receipt: ${receiptPath}`);
  const issues = metadata.has_issues ? list('issues').filter((issue) => !issue.pull_request) : [];
  if (!metadata.has_issues) skip('Issues は無効です。設定は変更しません');
  const matches = issues.map((issue) => {
    const marked = typeof issue.body === 'string' ? [...issue.body.matchAll(/^<!-- workshop-issue:([a-z][a-z0-9-]*) -->$/gm)].map((m) => m[1]) : [];
    const created = Object.entries(receipt?.created ?? {}).filter(([key, value]) => value?.id === issue.id
      && value.number === issue.number && receipt.issues[key] === issue.number).map(([key]) => key);
    const known = [...new Set([...marked, ...created])].filter((key) => keys.has(key) || created.includes(key));
    return { issue, keys: known };
  });
  const closeIssues = [];
  for (const item of matches) {
    if (item.issue.state !== 'open') continue;
    if (identity(item.issue, 'issues') && item.keys.length === 1
      && matches.filter((other) => other.keys.includes(item.keys[0])).length === 1) closeIssues.push(item.issue);
    else if (item.keys.length || Object.values(receipt?.issues ?? {}).includes(item.issue.number) || item.issue.title?.includes('[playbook:')) {
      skip(`Issue #${item.issue.number}: 明示マーカー / 作成記録が不足、または識別子が曖昧です`);
    }
  }
  const protectedNames = new Set([...worktreeBranches(), original, record?.original, journal?.original, branch, existing?.pr.head.ref]);
  const closeNumbers = new Set(closePRs.map((pr) => pr.number));
  const deleteBranches = [];
  for (const [name, owned] of branchProofs) {
    if (owned.kind !== 'checkpoint') continue;
    if (protectedNames.has(name) || pulls.some((pr) => pr.state === 'open' && !closeNumbers.has(pr.number)
      && (pr.base?.ref === name || (pr.head?.repo?.id === metadata.id && pr.head.ref === name)))) {
      skip(`${JSON.stringify(name)}: worktree / 保持する PR で使用中`); continue;
    }
    if (metadata.fork !== false || metadata.forks_count !== 0) {
      skip(`${JSON.stringify(name)}: fork 関係があるため外部 PR の安全性を保証できません`); continue;
    }
    deleteBranches.push({ name, commit: owned.commit });
  }
  if (!alreadyStarter && !existing) preserveIgnoredFiles(context, base, snapshot);
  console.log(`\nRESET PLAN: ${target.key}\n参加者 main: ${base}\n公式 starter main: ${snapshot}`);
  console.log(alreadyStarter ? 'main は既に starter と一致。新規 PR / checkout 変更なし。'
    : existing ? `既存 reset PR を再利用: ${existing.pr.html_url}`
      : `starter PR を作成 / 復帰: ${JSON.stringify(branch)}${record ? ` @ ${record.commit}` : ''} → main`);
  for (const issue of closeIssues) console.log(`CLOSE Issue #${issue.number} ${issue.html_url} ${JSON.stringify(issue.title)}`);
  for (const pr of closePRs) console.log(`CLOSE PR #${pr.number} ${pr.html_url} ${JSON.stringify(pr.head.ref)} @ ${pr.head.sha}`);
  for (const item of deleteBranches) console.log(`DELETE remote ${JSON.stringify(item.name)} @ ${item.commit} (local branches retained)`);
  console.log('全追跡ファイルを starter に戻すのは PR のマージ後です。削除差分を確認してください。必須チェック / 設定は変更せず、回避しません。');
  console.log('Issue は閉じるだけです。次の checkpoint1 も閉じたまま再利用します。ローカルブランチ、stash、ignored ファイル、Codespace は削除しません。');
  if (alreadyStarter && !closeIssues.length && !closePRs.length && !deleteBranches.length) {
    console.log('対象なし。Already reset; no writes required.'); return;
  }
  const confirmation = `RESET ${target.key}`;
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  const inputClosed = new AbortController();
  prompt.once('close', () => inputClosed.abort());
  let answer;
  try { answer = await prompt.question(`続行する場合だけ ${confirmation} と入力: `, { signal: inputClosed.signal }); }
  catch (error) {
    if (error.name === 'AbortError') throw new Error('Confirmation input closed; no writes confirmed.');
    throw error;
  }
  finally { prompt.close(); }
  if (answer !== confirmation) { console.log('Cancelled. No checkout or remote changes.'); return; }
  const fresh = preflight(context);
  requireThat(fresh.target.key === target.key && fresh.metadata.id === metadata.id, 'Participant identity changed; rerun the preview.');
  requireThat(heads().get('main') === base && git(['rev-parse', 'HEAD']).text === originalHead
    && git(['symbolic-ref', '--quiet', '--short', 'HEAD'], [0, 1]).text === original, 'main or HEAD changed since preview; rerun ./reset.');
  if (!alreadyStarter && !existing) {
    preserveIgnoredFiles(context, base, snapshot);
    if (!record) {
      const sign = git(['config', '--bool', '--get', 'commit.gpgsign'], [0, 1]).text === 'true' ? ['-S'] : [];
      const commit = git(['commit-tree', snapshotTree, '-p', base, ...sign, '-m', resetMessage(snapshot, base)]).text;
      requireThat(sha(commit) && tree(commit) === snapshotTree, 'Invalid reset commit.');
      record = { version: 1, repo: target.key, repoId: metadata.id, branch, snapshot, base, commit, original, originalHead };
    }
    save(record);
    state.record = record;
    state.journalPath = journalPath;
    if (git(['status', '--porcelain=v1', '--untracked-files=all']).text) {
      const before = git(['rev-parse', '--verify', '--quiet', 'refs/stash'], [0, 1]).text;
      git(['stash', 'push', '--include-untracked', '-m', `workshop reset before starter ${new Date().toISOString()}`]);
      const saved = git(['rev-parse', 'refs/stash']).text;
      requireThat(saved !== before, 'No new stash was created; inspect git status.');
      state.saved = { stash: saved, original, originalHead };
      record.stash = saved; record.original = original; record.originalHead = originalHead;
      save(record);
      done(`Saved work in stash ${saved}; never reapplied automatically.`);
    }
    requireThat(!git(['status', '--porcelain=v1', '--untracked-files=all']).text, 'Worktree is not clean after stashing.');
    const ref = `refs/heads/${branch}`;
    const localNow = git(['rev-parse', '--verify', '--quiet', ref], [0, 1]).text;
    if (localNow) requireThat(localNow === record.commit, `Local ${branch} changed; stopped.`);
    else git(['update-ref', ref, record.commit, '']);
    preserveIgnoredFiles(context, snapshot);
    git(['switch', branch]);
    requireThat(git(['rev-parse', 'HEAD']).text === record.commit && tree('HEAD') === snapshotTree, 'Reset branch differs from the prepared snapshot.');
    const remoteNow = heads().get(branch);
    if (remoteNow) requireThat(remoteNow === record.commit, `Remote ${branch} changed; stopped.`);
    else git(['push', '--no-follow-tags', '--recurse-submodules=no', `--force-with-lease=${ref}:`, 'origin', `${record.commit}:${ref}`]);
    done(`Reset branch ready: ${branch} @ ${record.commit}`);
    const known = list('pulls').filter((pr) => sameRepoPR(pr) && pr.head.ref === branch && pr.head.sha === record.commit);
    requireThat(known.length <= 1, 'Multiple PRs for the reset branch; inspect before retrying.');
    let pr = known[0];
    if (pr) requireThat(pr.state === 'open', `Existing reset PR ${pr.html_url} is closed. Reopen it manually; no duplicate created.`);
    else pr = api('/pulls', '--method', 'POST', '-f', 'title=スターターへ戻す', '-f', 'base=main', '-f', `head=${branch}`,
      '-f', `body=現在の公式 starter の全追跡ファイルへ戻します。main が戻るのは、この PR を確認してマージした後です。\n\n独自変更と削除を確認してください。必須チェックは回避しません。設定、Issue の履歴、stash、Codespace は変更しません。\n\n<details>\n<summary>取り込み元</summary>\n\n${source}\nスナップショット: \`${snapshot}\`\n参加者 main: \`${base}\`\nファイルのみを取り込み、元リポジトリの履歴はマージしません。\n</details>\n\n${marker(snapshot, base)}`);
    requireThat(sameRepoPR(pr) && pr.state === 'open' && pr.head.sha === record.commit && pr.head.ref === branch,
      'Could not confirm the reset PR. Rerun ./reset; inspect existing PRs before manual creation.');
    done(`Reset PR: ${pr.html_url}. Not merged.`);
  } else if (existing) done(`Reused reset PR: ${existing.pr.html_url}. Not merged.`);
  const unchanged = (before, after, kind) => identity(after, kind) && after.id === before.id
    && after.state === 'open' && after.title === before.title && after.body === before.body;
  for (const pr of closePRs) {
    const current = api(`/pulls/${pr.number}`);
    if (current.state === 'closed') continue;
    if (!unchanged(pr, current, 'pull') || !sameRepoPR(current) || current.head.sha !== pr.head.sha || current.head.ref !== pr.head.ref) {
      skip(`PR #${pr.number}: preview 後に変更されました`); continue;
    }
    const closed = api(`/pulls/${pr.number}`, '--method', 'PATCH', '-f', 'state=closed');
    requireThat(identity(closed, 'pull') && closed.id === pr.id && closed.state === 'closed', `Unconfirmed closure of PR #${pr.number}. Rerun after checking it.`);
    done(`Closed PR ${pr.html_url}. History retained; reopen manually if needed.`);
  }
  for (const issue of closeIssues) {
    const current = api(`/issues/${issue.number}`);
    if (current.state === 'closed') continue;
    if (!unchanged(issue, current, 'issues')) { skip(`Issue #${issue.number}: preview 後に変更されました`); continue; }
    const closed = api(`/issues/${issue.number}`, '--method', 'PATCH', '-f', 'state=closed', '-f', 'state_reason=not_planned');
    requireThat(identity(closed, 'issues') && closed.id === issue.id && closed.state === 'closed', `Unconfirmed closure of Issue #${issue.number}. Rerun after checking it.`);
    done(`Closed Issue ${issue.html_url}. History retained; checkpoint1 will not reopen it.`);
  }
  for (const item of deleteBranches) {
    const currentMetadata = api('');
    requireThat(currentMetadata.id === metadata.id, 'Repository identity changed; stopped before branch deletion.');
    const currentPRs = list('pulls').filter((pr) => pr.state === 'open');
    if (currentMetadata.fork !== false || currentMetadata.forks_count !== 0 || worktreeBranches().has(item.name)
      || currentPRs.some((pr) => pr.base?.ref === item.name || (pr.head?.repo?.id === metadata.id && pr.head.ref === item.name))) {
      skip(`${JSON.stringify(item.name)}: 現在 PR / worktree / fork で保護されています`); continue;
    }
    const current = heads().get(item.name);
    if (!current) continue;
    if (current !== item.commit) { skip(`${JSON.stringify(item.name)}: preview 後に変更されました`); continue; }
    const recovery = `refs/workshop-reset/recovery/${item.commit}`;
    const retained = git(['rev-parse', '--verify', '--quiet', recovery], [0, 1]).text;
    if (retained) requireThat(retained === item.commit, `Unexpected recovery ref: ${recovery}`);
    else git(['update-ref', recovery, item.commit, '']);
    done(`Recovery ${recovery}: git push --no-follow-tags --force-with-lease=refs/heads/${item.name}: origin ${item.commit}:refs/heads/${item.name}`);
    git(['push', '--no-follow-tags', '--recurse-submodules=no', `--force-with-lease=refs/heads/${item.name}:${item.commit}`, 'origin', `:refs/heads/${item.name}`]);
    requireThat(!heads().has(item.name), `Branch ${item.name} exists again. Inspect it; do not retry deletion without a new preview.`);
    done(`Deleted remote ${item.name} @ ${item.commit}. Local branches and recovery ref retained.`);
  }
  console.log('選択対象の処理が終了しました。Skip は保持されています。main は自動で変更せず、PR のマージもしていません。');
}

try { await main(); }
catch (error) {
  console.error(`Reset stopped: ${error.message}`);
  console.error(`Completed: ${state.completed.join(' | ') || 'none'}`);
  console.error('自動 rollback は行いません。git status と表示した URL を確認し、原因を解消して ./reset を再実行してください。成功済みの close/delete と既存 reset PR は再利用します。');
  if (state.record) console.error(`Reset commit ${state.record.commit}, branch ${state.record.branch}, journal ${state.journalPath}. Keep these records; do not overwrite a changed branch.`);
  process.exitCode = 1;
} finally {
  const saved = state.saved ?? (state.record?.stash ? state.record : null);
  if (saved) console.log(`Saved stash ${saved.stash} remains. When safe:\n${saved.original ? `git switch ${quote(saved.original)}` : `git switch --detach ${saved.originalHead}`}\ngit stash apply --index ${saved.stash}\nKeep the stash until you have checked the restored files.`);
  state.release?.();
}
