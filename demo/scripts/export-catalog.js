// Builds the automation catalog from the single test case source.
//   test-cases/catalog.json            map by case ID, read by the Playwright fixture
//   ../docs/dashboard/data/catalog.json full list with sprints, phases, modules and suites, read by the dashboard
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'test-cases/source/lawak-store.json'), 'utf8'));
const sprintPhase = Object.fromEntries(src.sprints.map((s) => [s.id, s.phase]));
const problems = [];
const seen = new Set();

const cases = src.cases.map((c) => {
  if (seen.has(c.id)) problems.push(`${c.id}: duplicate ID`);
  seen.add(c.id);
  if (!/^TC-[A-Z]+-\d{3}$/.test(c.id)) problems.push(`${c.id}: ID must be TC-<MODULE>-<3 digits>`);
  if (!c.id.startsWith(`TC-${c.module}-`)) problems.push(`${c.id}: ID does not match module ${c.module}`);
  if (!sprintPhase[c.sprint]) problems.push(`${c.id}: unknown sprint ${c.sprint}`);
  if (!c.steps || c.steps.length === 0) problems.push(`${c.id}: no steps`);
  const phase = sprintPhase[c.sprint];
  const tags = [
    ...c.suites.map((s) => '@' + s),
    '@' + c.module.toLowerCase(),
    '@sprint-' + c.sprint.slice(1),
    '@phase-' + phase.slice(1),
    '@' + c.layer.toLowerCase(),
  ];
  const ready = /\[TBD/.test(c.refs + JSON.stringify(c.steps)) ? 'Waiting for reference' : 'Ready';
  return Object.assign({}, c, { phase, tags, readiness: ready, tool: c.layer === 'API' ? 'Bruno CLI' : 'Playwright' });
});

if (problems.length) {
  console.error('Catalog problems:\n- ' + problems.join('\n- '));
  process.exit(1);
}

const byId = Object.fromEntries(cases.map((c) => [c.id, { title: c.title, steps: c.steps, tags: c.tags, layer: c.layer }]));
fs.writeFileSync(path.join(ROOT, 'test-cases/catalog.json'), JSON.stringify(byId, null, 2) + '\n');

const dash = { project: src.project, version: src.version, generatedAt: new Date().toISOString(), phases: src.phases, sprints: src.sprints, modules: src.modules, suites: src.suites, cases };
const out = path.join(ROOT, '../docs/dashboard/data/catalog.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(dash, null, 2) + '\n');
console.log(`Catalog: ${cases.length} cases (${cases.filter((c) => c.layer === 'UI').length} UI, ${cases.filter((c) => c.layer === 'API').length} API)`);
