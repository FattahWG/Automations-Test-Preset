// QA Lab run: builds the Word evidence document from the run folder and uploads it, so visitors can download it.
// Same steps as run-suite.js (collect, run-meta.json, build_evidence_docx.py), for one GitHub Actions run.
//
//   node scripts/qa-lab-evidence.js --run-dir automation/last-run --suite smoke|regression|custom|api
//
// Needs BACKEND_URL and RUNNER_TOKEN. The run ID comes from RUN_ID or the file the reporter wrote.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { collect } = require('./lib/collect');

const ROOT = path.resolve(__dirname, '..');
const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const runDir = path.resolve(ROOT, arg('run-dir', 'automation/last-run'));
const suite = arg('suite', 'regression');
const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const RUNNER_TOKEN = process.env.RUNNER_TOKEN || '';
const runIdFile = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'qa-lab-run-id');
const runId = process.env.RUN_ID || (fs.existsSync(runIdFile) ? fs.readFileSync(runIdFile, 'utf8').trim() : '');

async function main() {
  if (!BACKEND_URL || !RUNNER_TOKEN || !runId) {
    console.log('[qa-lab] no backend or run ID: no evidence upload');
    return;
  }
  const env = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/environment.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-cases/catalog.json'), 'utf8'));
  const cases = collect(runDir, catalog);
  if (!cases.length) {
    console.log('[qa-lab] no results in the run folder: no evidence document');
    return;
  }
  fs.writeFileSync(path.join(runDir, 'case-results.json'), JSON.stringify(cases, null, 2));

  const count = (s) => cases.filter((c) => c.status === s).length;
  const startedAt = process.env.QA_LAB_STARTED_AT || new Date().toISOString();
  const meta = {
    scenario: `qa-lab-${suite}`,
    run: runId.slice(0, 8),
    suite,
    filters: { sprint: null, phase: null, module: null },
    command: suite === 'api' ? 'bru run -r --env local' : `npx playwright test --project=chromium --grep "${process.env.QA_LAB_GREP || '@regression'}"`,
    grep: process.env.QA_LAB_GREP || '',
    target: env.baseUrl,
    browser: suite === 'api' ? 'Bruno CLI (no browser)' : 'Chromium (headless, GitHub Actions)',
    startedAt,
    finishedAt: new Date().toISOString(),
    totals: { cases: cases.length, pass: count('Pass'), fail: count('Fail'), skipped: count('Skipped') },
    exitCodes: { playwright: null, bruno: null },
  };
  fs.writeFileSync(path.join(runDir, 'run-meta.json'), JSON.stringify(meta, null, 2));

  const py = process.platform === 'win32' ? 'python' : 'python3';
  const build = spawnSync(py, ['scripts/build_evidence_docx.py', '--run', runDir], { cwd: ROOT, stdio: 'inherit' });
  const docx = path.join(runDir, `Evidence_${meta.scenario}_${meta.run}.docx`);
  if (build.status !== 0 || !fs.existsSync(docx)) {
    console.error('[qa-lab] the evidence document was not built');
    return;
  }

  const key = `runs/${runId}/evidence.docx`;
  const response = await fetch(`${BACKEND_URL}/api/runner/artifacts/${key}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${RUNNER_TOKEN}`, 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    body: fs.readFileSync(docx),
  }).catch((err) => ({ ok: false, status: err.message }));
  console.log(`[qa-lab] evidence ${(fs.statSync(docx).size / 1024).toFixed(0)} KB upload: ${response.ok ? 'done' : 'rejected ' + response.status}`);
}

main();
