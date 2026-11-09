import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const validKey = (key) => typeof key === 'string' && /^[a-z][a-z0-9-]*$/.test(key);
const validNumber = (number) => Number.isSafeInteger(number) && number > 0;

export function prepareIssues(catalogue, { directory, target, metadata, run, done }) {
  requireThat(Array.isArray(catalogue) && catalogue.length > 0
    && catalogue.every((item) => item && validKey(item.key)
      && typeof item.title === 'string' && item.title.startsWith(`[playbook:${item.key}] `) && item.title.length <= 256
      && typeof item.body === 'string' && item.body.includes(`<!-- workshop-issue:${item.key} -->`) && item.body.length <= 65536)
    && new Set(catalogue.map((item) => item.key)).size === catalogue.length,
  'The canonical issue catalogue is invalid; no issues were created.');
  requireThat(validNumber(metadata.id), 'Cannot identify the participant repository for issue receipts.');
  const endpoint = `repos/${target.path}/issues`;
  const api = (args) => JSON.parse(run('gh', ['api', '--hostname', target.host, ...args]).text);
  const list = () => {
    const pages = api([`${endpoint}?state=all&per_page=100&sort=created&direction=asc`, '--paginate', '--slurp']);
    requireThat(Array.isArray(pages) && pages.every(Array.isArray), 'Cannot read all participant issues; stopped before the next creation.');
    const issues = pages.flat().filter((issue) => !issue.pull_request);
    requireThat(issues.every((issue) => validNumber(issue.number)), 'Invalid participant issue listing.');
    return [...new Map(issues.map((issue) => [issue.number, issue])).values()];
  };
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const receiptPath = join(directory, `${encodeURIComponent(target.host.toLowerCase())}-${metadata.id}.json`);
  const lockPath = `${receiptPath}.lock`;
  let lock;
  try {
    lock = openSync(lockPath, 'wx', 0o600);
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Issue preparation is locked. Inspect ${lockPath}; remove a stale lock only after confirming its process has stopped.`);
    throw error;
  }
  try {
    writeFileSync(lock, `${process.pid}\n`);
    let receipt = { version: 1, issues: {} };
    if (existsSync(receiptPath)) {
      try { receipt = JSON.parse(readFileSync(receiptPath, 'utf8')); }
      catch (error) { throw new Error(`Cannot read issue receipt ${receiptPath}: ${error.message}. Inspect it before retrying; keep recorded identities.`); }
    }
    requireThat(receipt?.version === 1 && receipt.issues && typeof receipt.issues === 'object'
      && !Array.isArray(receipt.issues) && Object.entries(receipt.issues).every(([key, number]) => validKey(key) && validNumber(number))
      && new Set(Object.values(receipt.issues)).size === Object.keys(receipt.issues).length,
    `Invalid issue receipt: ${receiptPath}. Inspect it before retrying; do not discard recorded issue identities.`);
    const save = () => {
      const temporary = `${receiptPath}.tmp`;
      const file = openSync(temporary, 'wx', 0o600);
      try {
        try { writeFileSync(file, `${JSON.stringify(receipt, null, 2)}\n`); }
        finally { closeSync(file); }
        renameSync(temporary, receiptPath);
      } finally {
        if (existsSync(temporary)) unlinkSync(temporary);
      }
    };
    const find = (item, issues) => {
      const recorded = Object.hasOwn(receipt.issues, item.key) ? receipt.issues[item.key] : undefined;
      requireThat(!recorded || issues.some((issue) => issue.number === recorded),
        `Recorded issue #${recorded} for ${item.key} is missing or transferred. Inspect ${receiptPath} and the repository; no replacement was created.`);
      const matches = issues.filter((issue) => issue.number === recorded
        || (typeof issue.body === 'string' && issue.body.includes(`<!-- workshop-issue:${item.key} -->`))
        || (typeof issue.title === 'string' && issue.title.includes(`[playbook:${item.key}]`)));
      requireThat(matches.length <= 1, `Multiple issues match ${item.key}: ${matches.map((issue) => `#${issue.number}`).join(', ')}. Resolve their identities before retrying.`);
      return matches[0];
    };
    let issues = list();
    const matches = catalogue.map((item) => find(item, issues)).filter(Boolean);
    requireThat(new Set(matches.map((issue) => issue.number)).size === matches.length,
      'An existing issue matches multiple catalogue keys. Resolve the conflicting identities before retrying.');
    let created = 0, reused = 0;
    for (const item of catalogue) {
      let issue = find(item, issues);
      if (!issue) {
        // 作成直前に REST の全状態一覧を再確認し、検索インデックスの反映待ちを避ける。
        issues = list();
        issue = find(item, issues);
      }
      const existing = Boolean(issue);
      if (!issue) {
        try {
          issue = api([endpoint, '--method', 'POST', '-f', `title=${item.title}`, '-f', `body=${item.body}`]);
        } catch (error) {
          throw new Error(`Could not confirm creation of ${item.key}: ${error.message}\nThe request may have succeeded. Check participant issues; a rerun reads existing markers before creating anything.`);
        }
      }
      requireThat(validNumber(issue.number) && typeof issue.html_url === 'string', `Invalid issue response for ${item.key}; inspect participant issues before retrying.`);
      const actual = new URL(issue.html_url);
      const expected = new URL(`https://${target.host}/${target.path}/issues/${issue.number}`);
      requireThat(actual.origin === expected.origin && actual.pathname.toLowerCase() === expected.pathname.toLowerCase(),
        `Issue ${item.key} belongs to a different repository; stopped without recording it.`);
      requireThat(!Object.entries(receipt.issues).some(([key, number]) => key !== item.key && number === issue.number),
        `Issue #${issue.number} already belongs to another catalogue key; inspect its identity before retrying.`);
      done(`${existing ? 'Reused' : 'Created'} issue ${item.key}: #${issue.number} (${issue.state}) ${issue.html_url}`);
      receipt.issues[item.key] = issue.number;
      save();
      if (existing) reused++; else { created++; issues.push(issue); }
    }
    done(`Workshop issues ready: ${created} created, ${reused} reused. Existing titles, bodies and states were not changed.`);
  } finally {
    closeSync(lock);
    unlinkSync(lockPath);
  }
}
