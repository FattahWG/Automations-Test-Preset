// Official run: makes a new RunTestN folder, runs Playwright and (for smoke and full) Bruno,
// then builds the evidence document, updates the workbook and publishes the result to the dashboard.
//
//   node scripts/run-suite.js --suite smoke|regression|full [--sprint 2] [--phase 1] [--module chk] [--no-publish]
//
// The dashboard on GitHub Pages shows the same command for each filter choice.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { collect } = require('./lib/collect');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : def;
};
const suite = arg('suite', process.env.SUITE || 'smoke');
const sprint = arg('sprint');
const phase = arg('phase');
const moduleCode = arg('module');
const publish = !process.argv.includes('--no-publish');
if (!['smoke', 'regression', 'full'].includes(suite)) { console.error('--suite must be smoke, regression or full'); process.exit(2); }

// Playwright grep: every chosen tag must be present (regex lookaheads = AND).
const tags = [suite === 'full' ? '@regression' : '@' + suite];
if (sprint) tags.push('@sprint-' + sprint);
if (phase) tags.push('@phase-' + phase);
if (moduleCode) tags.push('@' + moduleCode.toLowerCase());
const grep = tags.map((t) => `(?=.*${t}\\b)`).join('');
const scenario = [suite, sprint && 'sprint-' + sprint, phase && 'phase-' + phase, moduleCode && moduleCode.toLowerCase()].filter(Boolean).join('-');

const scenarioDir = path.join(ROOT, 'automation', 'scenarios', scenario);
fs.mkdirSync(scenarioDir, { recursive: true });
const runNo = fs.readdirSync(scenarioDir).filter((d) => /^RunTest\d+$/.test(d)).map((d) => Number(d.slice(7))).reduce((a, b) => Math.max(a, b), 0) + 1;
const runDir = path.join(scenarioDir, 'RunTest' + runNo);
fs.mkdirSync(runDir, { recursive: true });

const env = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/environment.json'), 'utf8'));
const startedAt = new Date();
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, Object.assign({ cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32', env: Object.assign({}, process.env, { RUN_DIR: runDir }) }, opts));

console.log(`\n== ${scenario} / RunTest${runNo} ==\nPlaywright --grep "${grep}" --project=msedge`);
spawnSync('node', ['scripts/export-catalog.js'], { cwd: ROOT, stdio: 'inherit' });
const pw = run(npx, ['playwright', 'test', '--grep', `"${grep}"`, '--project=msedge']);

let bru = { status: null };
const runBruno = suite === 'smoke' || suite === 'full';
if (runBruno) {
  // Bruno needs the demo server. Playwright stopped its own server, so start one for the API suite.
  const server = require('child_process').spawn('node', ['server/server.js'], { cwd: ROOT, stdio: 'ignore' });
  const waitScript = `const u='${env.baseUrl}/api/products';let n=0;(function t(){fetch(u).then(()=>process.exit(0)).catch(()=>{if(++n>40)process.exit(1);setTimeout(t,250);});})();`;
  spawnSync('node', ['-e', waitScript]);
  const bruArgs = ['bru', 'run', '--env', 'local', '-r',
    '--reporter-json', path.join(runDir, 'bruno', 'results.json'),
    '--reporter-junit', path.join(runDir, 'bruno', 'junit.xml'),
    '--reporter-html', path.join(runDir, 'bruno', 'report.html'),
    '--reporter-skip-headers', '"Authorization Cookie"'];
  if (suite === 'smoke') bruArgs.push('--tags', 'smoke');
  fs.mkdirSync(path.join(runDir, 'bruno'), { recursive: true });
  bru = run(npx, bruArgs.map((a) => (/\s/.test(a) && !a.startsWith('"') ? `"${a}"` : a)), { cwd: path.join(ROOT, 'api-testing', 'lawak-store') });
  server.kill();
}

// Normalize, then filter API cases by the same sprint/phase/module filters as the UI cases.
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-cases/catalog.json'), 'utf8'));
let cases = collect(runDir, catalog).filter((c) => {
  const t = (catalog[c.id] || {}).tags || [];
  return tags.slice(1).every((tag) => t.includes(tag));
});
fs.writeFileSync(path.join(runDir, 'case-results.json'), JSON.stringify(cases, null, 2));

const count = (s) => cases.filter((c) => c.status === s).length;
const meta = {
  scenario, run: 'RunTest' + runNo, suite, filters: { sprint: sprint || null, phase: phase || null, module: moduleCode || null },
  command: `node scripts/run-suite.js --suite ${suite}${sprint ? ' --sprint ' + sprint : ''}${phase ? ' --phase ' + phase : ''}${moduleCode ? ' --module ' + moduleCode : ''}`,
  grep, target: env.baseUrl, browser: 'Microsoft Edge (msedge)', startedAt: startedAt.toISOString(), finishedAt: new Date().toISOString(),
  totals: { cases: cases.length, pass: count('Pass'), fail: count('Fail'), skipped: count('Skipped') },
  exitCodes: { playwright: pw.status, bruno: bru.status },
};
fs.writeFileSync(path.join(runDir, 'run-meta.json'), JSON.stringify(meta, null, 2));
console.log(`\nResult: ${meta.totals.pass} pass, ${meta.totals.fail} fail, ${meta.totals.skipped} skipped (${meta.totals.cases} cases)`);

// Evidence document, then workbook results, then the dashboard.
const py = process.platform === 'win32' ? 'python' : 'python3';
spawnSync(py, ['scripts/build_evidence_docx.py', '--run', runDir], { cwd: ROOT, stdio: 'inherit' });
spawnSync(py, ['scripts/build_testcases.py', '--run', runDir], { cwd: ROOT, stdio: 'inherit' });
if (publish) spawnSync('node', ['scripts/publish-dashboard.js', '--run', runDir], { cwd: ROOT, stdio: 'inherit' });
console.log(`Run folder: ${path.relative(ROOT, runDir)}`);
process.exit(meta.totals.fail ? 1 : 0);
