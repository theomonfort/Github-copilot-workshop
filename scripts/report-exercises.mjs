import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Usage: node scripts/report-exercises.mjs <CodeQL SARIF> <output directory>');
}
const sarif = JSON.parse(readFileSync(input, 'utf8'));
const expected = JSON.parse(readFileSync(resolve(root, 'workshop-exercises/expected-findings.json'), 'utf8'));
if (!Array.isArray(sarif.runs) || sarif.runs.length === 0) {
  throw new Error('CodeQL SARIF contains no analysis runs.');
}

const findings = sarif.runs.flatMap(run => {
  if (!Array.isArray(run.results)) throw new Error('CodeQL run contains no results array.');
  return run.results.flatMap(result => (result.locations ?? []).map(location => ({
    rule: result.ruleId,
    file: decodeURIComponent(location.physicalLocation?.artifactLocation?.uri ?? ''),
    line: location.physicalLocation?.region?.startLine,
  })));
});
const matrix = expected.map(item => ({
  ...item,
  observedLines: findings
    .filter(result => result.rule === item.rule &&
      (result.file === item.file || result.file.endsWith(`/${item.file}`)))
    .map(result => result.line),
}));
mkdirSync(output, { recursive: true });
for (const kind of ['security', 'quality']) {
  const filtered = {
    ...sarif,
    runs: sarif.runs.map(run => ({
      ...run,
      results: run.results.filter(result => {
        const rule = run.tool.driver.rules.find(rule => rule.id === result.ruleId);
        if (!rule) throw new Error(`Missing SARIF rule metadata: ${result.ruleId}`);
        return rule.properties?.tags?.includes(kind);
      }),
    })),
  };
  writeFileSync(resolve(output, `${kind}.sarif`), JSON.stringify(filtered, null, 2));
}
writeFileSync(resolve(output, 'findings.json'), JSON.stringify({ matrix, findings }, null, 2));
const summary = [
  '# Workshop exercise analysis',
  '',
  'Actual CodeQL results. Quality rules are not a GitHub Code Quality service run or a Copilot review.',
  'A missing finding can mean an exercise was fixed. This report does not require vulnerabilities to remain.',
  '',
  '| Checkpoint | Kind | File | Expected rule | Observed lines |',
  '| --- | --- | --- | --- | --- |',
  ...matrix.map(item => `| ${item.checkpoint} | ${item.kind} | ${item.file} | ${item.rule} | ${item.observedLines.join(', ') || 'Not detected'} |`),
  '',
].join('\n');
writeFileSync(resolve(output, 'summary.md'), summary);
console.log(summary);
