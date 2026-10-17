// Copies the result of one run to the GitHub Pages site (../docs):
//   docs/dashboard/data/runs.json         run summaries (last 12 runs), no local paths and no tokens
//   docs/documents/evidence/*.docx        evidence document of each listed run
//   docs/documents/LawakStore_TestCases.xlsx
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.resolve(ROOT, '../docs');
const i = process.argv.indexOf('--run');
if (i < 0) { console.error('Usage: node scripts/publish-dashboard.js --run <RUN_DIR>'); process.exit(2); }
const runDir = path.resolve(process.argv[i + 1]);
const meta = JSON.parse(fs.readFileSync(path.join(runDir, 'run-meta.json'), 'utf8'));
const results = JSON.parse(fs.readFileSync(path.join(runDir, 'case-results.json'), 'utf8'));

const evidenceDir = path.join(DOCS, 'documents', 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });
const docName = `Evidence_${meta.scenario}_${meta.run}.docx`;
const docSrc = path.join(runDir, docName);
const hasDoc = fs.existsSync(docSrc);
if (hasDoc) fs.copyFileSync(docSrc, path.join(evidenceDir, docName));

const wb = path.join(ROOT, 'test-cases', 'LawakStore_TestCases.xlsx');
if (fs.existsSync(wb)) fs.copyFileSync(wb, path.join(DOCS, 'documents', 'LawakStore_TestCases.xlsx'));

const runsFile = path.join(DOCS, 'dashboard', 'data', 'runs.json');
const runs = fs.existsSync(runsFile) ? JSON.parse(fs.readFileSync(runsFile, 'utf8')) : [];
const entry = {
  key: `${meta.scenario}/${meta.run}`, scenario: meta.scenario, run: meta.run, suite: meta.suite, filters: meta.filters,
  command: meta.command, browser: meta.browser, startedAt: meta.startedAt, finishedAt: meta.finishedAt, totals: meta.totals,
  evidence: hasDoc ? `documents/evidence/${docName}` : null,
  cases: results.map((r) => {
    const failed = r.steps.find((s) => s.status === 'Fail');
    return {
      id: r.id, status: r.status, layer: r.layer, durationMs: r.durationMs,
      failedStep: failed ? `S${String(failed.no).padStart(2, '0')} ${failed.title}` : null,
      note: failed ? failed.actual.slice(0, 300) : null, issue: r.issue || null,
    };
  }),
};
const next = [entry, ...runs.filter((r) => r.key !== entry.key)].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt)).slice(0, 12);
fs.writeFileSync(runsFile, JSON.stringify(next, null, 2) + '\n');

// Remove evidence files of runs that dropped out of the list (only files this script made).
const keep = new Set(next.map((r) => r.evidence && path.basename(r.evidence)).filter(Boolean));
fs.readdirSync(evidenceDir).filter((f) => /^Evidence_.*\.docx$/.test(f) && !keep.has(f)).forEach((f) => fs.unlinkSync(path.join(evidenceDir, f)));
console.log(`Published ${entry.key} to docs/dashboard/data/runs.json`);
