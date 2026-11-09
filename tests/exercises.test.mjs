import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const expected = JSON.parse(readFileSync(join(root, 'workshop-exercises/expected-findings.json'), 'utf8'));

test('教材は各段階で1組ずつ追加され、トップレベルで実行されない', () => {
  const stages = [...new Set(expected.map(item => item.checkpoint))].sort();
  assert.deepEqual(stages, Array.from({ length: stages.length }, (_, index) => index + 1));
  for (const stage of stages) {
    assert.deepEqual(expected.filter(item => item.checkpoint === stage).map(item => item.kind).sort(),
      ['quality', 'security']);
  }
  const fixtures = readdirSync(join(root, 'workshop-exercises'), { recursive: true })
    .filter(file => file.endsWith('.ts')).map(file => `workshop-exercises/${file}`);
  assert.deepEqual(fixtures.sort(), expected.map(item => item.file).sort());
  for (const { file } of expected) {
    const source = ts.createSourceFile(file, readFileSync(join(root, file), 'utf8'), ts.ScriptTarget.Latest, true);
    assert.equal(source.parseDiagnostics.length, 0, file);
    for (const statement of source.statements) {
      assert.ok(ts.isImportDeclaration(statement) || ts.isFunctionDeclaration(statement), file);
      if (ts.isImportDeclaration(statement)) {
        assert.match(statement.moduleSpecifier.text, /^node:(https|crypto)$/);
      } else {
        assert.ok(statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword), file);
      }
    }
  }
  for (const directory of ['src', 'public']) {
    for (const file of readdirSync(join(root, directory), { recursive: true })
      .filter(file => /\.(astro|[cm]?js|tsx?|html)$/.test(file))) {
      assert.doesNotMatch(readFileSync(join(root, directory, file), 'utf8'), /workshop-exercises/);
    }
  }
  const workflow = readFileSync(join(root, '.github/workflows/workshop-exercises.yml'), 'utf8');
  assert.match(workflow, /if: github\.repository == 'theomonfort\/Github-copilot-workshop'/);
});

test('SARIF の実際の検出だけを記録し、security と quality を分離する', t => {
  const temporary = mkdtempSync(join(tmpdir(), 'workshop-exercise-report-'));
  t.after(() => rmSync(temporary, { recursive: true, force: true }));
  const input = join(temporary, 'input.sarif');
  const output = join(temporary, 'output');
  const rules = expected.map(item => ({ id: item.rule, properties: { tags: [item.kind] } }));
  const results = expected.map((item, index) => ({
    ruleId: item.rule,
    ruleIndex: index,
    locations: [{ physicalLocation: { artifactLocation: { uri: item.file }, region: { startLine: 5 } } }],
  }));
  const sarif = { version: '2.1.0', runs: [{ tool: { driver: { name: 'CodeQL', rules } }, results }] };
  writeFileSync(input, JSON.stringify(sarif));
  const report = () => execFileSync(process.execPath, [join(root, 'scripts/report-exercises.mjs'), input, output],
    { stdio: 'pipe' });
  report();
  assert.ok(JSON.parse(readFileSync(join(output, 'findings.json'))).matrix.every(item => item.observedLines[0] === 5));
  for (const kind of ['security', 'quality']) {
    assert.deepEqual(JSON.parse(readFileSync(join(output, `${kind}.sarif`))).runs[0].results.map(item => item.ruleId),
      expected.filter(item => item.kind === kind).map(item => item.rule));
  }
  sarif.runs[0].tool.driver.rules = [];
  sarif.runs[0].tool.extensions = [{ name: 'codeql/javascript-queries', rules }];
  writeFileSync(input, JSON.stringify(sarif));
  report();
  assert.deepEqual(JSON.parse(readFileSync(join(output, 'security.sarif'))).runs[0].results.map(item => item.ruleId),
    expected.filter(item => item.kind === 'security').map(item => item.rule));
  sarif.runs[0].results = [];
  writeFileSync(input, JSON.stringify(sarif));
  report();
  assert.ok(JSON.parse(readFileSync(join(output, 'findings.json'))).matrix.every(item => item.observedLines.length === 0));
  assert.match(readFileSync(join(output, 'summary.md'), 'utf8'), /Not detected/);
  writeFileSync(input, '{"runs":[]}');
  assert.throws(report, /contains no analysis runs/);
});
