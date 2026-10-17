// Reads the raw Playwright and Bruno reports of one run and returns one result per test case.
// The Word, Excel and dashboard scripts read only this normalized file (case-results.json).
const fs = require('fs');
const path = require('path');

const stripAnsi = (s) => String(s || '').replace(/\u001b\[[0-9;]*m/g, '');
const firstLine = (s) => stripAnsi(s).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4).join(' ');

function walkSpecs(suite, out) {
  (suite.specs || []).forEach((s) => out.push(s));
  (suite.suites || []).forEach((child) => walkSpecs(child, out));
  return out;
}

function playwrightCases(runDir) {
  const file = path.join(runDir, 'results.json');
  if (!fs.existsSync(file)) return [];
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  const specs = [];
  (report.suites || []).forEach((s) => walkSpecs(s, specs));
  return specs.map((spec) => {
    const id = spec.title.split(' ')[0];
    const test = spec.tests[0];
    const result = test.results[test.results.length - 1] || { status: 'skipped', steps: [], attachments: [] };
    const annotations = [...(test.annotations || []), ...(result.annotations || [])];
    const attachments = result.attachments || [];
    const steps = (result.steps || []).filter((st) => /^\[(UI|API)\] TC-/.test(st.title)).map((st) => {
      const m = /^\[(UI|API)\] (TC-[A-Z]+-\d+) S(\d+) (.*)$/.exec(st.title);
      const no = m ? m[3] : '00';
      const evidence = attachments.find((a) => a.name === `${id}_${no}-${m ? m[1] : 'UI'}.png` || a.name === `${id}_${no}-API.json`);
      // Attachments made with a body arrive inline as base64. Write them out once, as evidence/<name>.
      if (evidence && !evidence.path && evidence.body) {
        const file = path.join(runDir, 'evidence', evidence.name);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(evidence.body, 'base64'));
        evidence.path = file;
      }
      const actual = annotations.find((a) => a.type === `actual-S${no}`);
      return {
        no: Number(no), layer: m ? m[1] : 'UI', title: m ? m[4] : st.title,
        status: st.error ? 'Fail' : 'Pass',
        actual: st.error ? firstLine(st.error.message) : (actual ? actual.description : 'As expected.'),
        evidence: evidence && evidence.path ? path.relative(runDir, evidence.path) : null,
        durationMs: st.duration,
      };
    });
    const status = result.status === 'passed' ? 'Pass' : result.status === 'skipped' ? 'Skipped' : 'Fail';
    const issue = annotations.find((a) => a.type === 'issue');
    return {
      id, title: spec.title.replace(/^TC-[A-Z]+-\d+ /, ''), layer: 'UI', tool: 'Playwright', browser: test.projectName,
      status, durationMs: result.duration, steps,
      error: status === 'Fail' ? firstLine((result.errors && result.errors[0] && result.errors[0].message) || (result.error && result.error.message)) : null,
      issue: issue ? issue.description : null,
      trace: (attachments.find((a) => a.name === 'trace') || {}).path ? path.relative(runDir, attachments.find((a) => a.name === 'trace').path) : null,
    };
  });
}

function brunoCases(runDir) {
  const file = path.join(runDir, 'bruno', 'results.json');
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const iteration = Array.isArray(raw) ? raw[0] : raw;
  const byCase = {};
  (iteration.results || []).forEach((r) => {
    const m = /^(TC-[A-Z]+-\d+) S(\d+) (.*)$/.exec(r.name || '');
    if (!m) return; // setup and cleanup requests are not test cases
    const failures = [...(r.assertionResults || []), ...(r.testResults || [])].filter((x) => x.status !== 'pass');
    const res = r.response || {};
    const evidenceName = `${m[1]}_${m[2]}-API.json`;
    const evidencePath = path.join(runDir, 'bruno', 'evidence', evidenceName);
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    const body = JSON.stringify(res.data === undefined ? null : res.data, (k, v) => (/^(token|password)$/i.test(k) ? '***' : v), 2);
    fs.writeFileSync(evidencePath, JSON.stringify({
      request: { method: r.request && r.request.method, url: r.request && r.request.url },
      response: { status: res.status, body: JSON.parse(body) },
    }, null, 2));
    const step = {
      no: Number(m[2]), layer: 'API', title: m[3], status: failures.length || r.error ? 'Fail' : 'Pass',
      actual: failures.length || r.error
        ? `HTTP ${res.status}. ` + (r.error ? String(r.error) : failures.map((f) => f.error || f.description || `${f.lhsExpr} ${f.rhsExpr}`).join('; '))
        : `HTTP ${res.status} ${res.statusText || ''}`.trim() + '.',
      evidence: path.relative(runDir, evidencePath), durationMs: r.runDuration ? Math.round(r.runDuration * 1000) : res.responseTime,
    };
    const c = byCase[m[1]] || (byCase[m[1]] = { id: m[1], title: m[3], layer: 'API', tool: 'Bruno CLI', browser: '-', steps: [], durationMs: 0 });
    c.steps.push(step);
    c.durationMs += step.durationMs || 0;
  });
  return Object.values(byCase).map((c) => {
    c.steps.sort((a, b) => a.no - b.no);
    c.status = c.steps.some((s) => s.status === 'Fail') ? 'Fail' : 'Pass';
    c.error = c.status === 'Fail' ? c.steps.find((s) => s.status === 'Fail').actual : null;
    return c;
  });
}

function collect(runDir, catalog) {
  const cases = [...playwrightCases(runDir), ...brunoCases(runDir)].map((c) => {
    const meta = catalog[c.id] || {};
    return Object.assign({}, c, { title: meta.title || c.title });
  });
  cases.sort((a, b) => a.id.localeCompare(b.id));
  return cases;
}

module.exports = { collect };
