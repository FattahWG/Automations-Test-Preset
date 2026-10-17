(async function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PILL = { Pass: 'ok', Fail: 'bad', Skipped: 'warn' };

  let catalog;
  let runs = [];
  try {
    catalog = await fetch('data/catalog.json').then((r) => r.json());
    runs = await fetch('data/runs.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  } catch (e) {
    document.querySelector('main').innerHTML = '<div class="card pad">The dashboard data could not load. Reload the page.</div>';
    return;
  }

  const modules = Object.fromEntries(catalog.modules.map((m) => [m.code, m.name]));
  const sprintName = Object.fromEntries(catalog.sprints.map((s) => [s.id, s.name]));
  // Newest result of each case, from the newest run that contains it.
  const latest = {};
  runs.forEach((run) => run.cases.forEach((c) => { if (!latest[c.id]) latest[c.id] = Object.assign({ run: run.key, at: run.finishedAt }, c); }));

  // ---------- state (kept in the URL so a selection can be shared) ----------
  const params = new URLSearchParams(location.hash.slice(1));
  const state = {
    suite: ['smoke', 'regression', 'full'].includes(params.get('suite')) ? params.get('suite') : 'smoke',
    phase: params.get('phase') || '', sprint: params.get('sprint') || '', module: params.get('module') || '', q: '',
  };
  const saveState = () => {
    const p = new URLSearchParams();
    ['suite', 'phase', 'sprint', 'module'].forEach((k) => { if (state[k]) p.set(k, state[k]); });
    history.replaceState(null, '', '#' + p.toString());
  };

  // ---------- controls ----------
  const suiteCount = (id) => catalog.cases.filter((c) => (id === 'full' ? true : c.suites.includes(id))).length;
  $('suite-choice').innerHTML = catalog.suites.map((s) => `
    <div><input type="radio" name="suite" id="s-${s.id}" value="${s.id}" ${state.suite === s.id ? 'checked' : ''}>
    <label for="s-${s.id}"><span class="name">${esc(s.name)}<span class="pill">${suiteCount(s.id)} cases</span></span><span class="desc">${esc(s.description)}</span></label></div>`).join('');
  document.querySelectorAll('input[name="suite"]').forEach((r) => r.addEventListener('change', () => { state.suite = r.value; update(); }));

  const fillPhase = () => {
    $('f-phase').innerHTML = '<option value="">All phases</option>' + catalog.phases.map((p) => `<option value="${p.id.slice(1)}" ${state.phase === p.id.slice(1) ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  };
  const fillSprint = () => {
    const list = catalog.sprints.filter((s) => !state.phase || s.phase === 'P' + state.phase);
    if (state.sprint && !list.some((s) => s.id === 'S' + state.sprint)) state.sprint = '';
    $('f-sprint').innerHTML = '<option value="">All sprints</option>' + list.map((s) => `<option value="${s.id.slice(1)}" ${state.sprint === s.id.slice(1) ? 'selected' : ''}>${esc(s.name)}: ${esc(s.goal)}</option>`).join('');
  };
  const fillModule = () => {
    $('f-module').innerHTML = '<option value="">All modules</option>' + catalog.modules.map((m) => `<option value="${m.code.toLowerCase()}" ${state.module === m.code.toLowerCase() ? 'selected' : ''}>${esc(m.name)} (${m.code})</option>`).join('');
  };
  fillPhase(); fillSprint(); fillModule();
  $('f-phase').addEventListener('change', (e) => { state.phase = e.target.value; fillSprint(); update(); });
  $('f-sprint').addEventListener('change', (e) => { state.sprint = e.target.value; update(); });
  $('f-module').addEventListener('change', (e) => { state.module = e.target.value; update(); });
  $('q').addEventListener('input', (e) => { state.q = e.target.value.trim().toLowerCase(); renderCases(selected()); });

  function selected() {
    return catalog.cases.filter((c) =>
      (state.suite === 'full' || c.suites.includes(state.suite)) &&
      (!state.phase || c.phase === 'P' + state.phase) &&
      (!state.sprint || c.sprint === 'S' + state.sprint) &&
      (!state.module || c.module.toLowerCase() === state.module));
  }

  // ---------- commands ----------
  function cmdBlock(el, text) {
    el.innerHTML = `${esc(text)}<button class="btn copy" type="button">Copy</button>`;
    el.querySelector('.copy').addEventListener('click', async (ev) => {
      try { await navigator.clipboard.writeText(text); ev.target.textContent = 'Copied'; } catch (e) { ev.target.textContent = 'Select and copy'; }
      setTimeout(() => { ev.target.textContent = 'Copy'; }, 1500);
    });
  }

  function commands(list) {
    const flags = [state.phase && `--phase ${state.phase}`, state.sprint && `--sprint ${state.sprint}`, state.module && `--module ${state.module}`].filter(Boolean).join(' ');
    cmdBlock($('cmd-run'), `cd demo\nnode scripts/run-suite.js --suite ${state.suite}${flags ? ' ' + flags : ''}`);
    const tags = [state.suite === 'full' ? '@regression' : '@' + state.suite];
    if (state.phase) tags.push('@phase-' + state.phase);
    if (state.sprint) tags.push('@sprint-' + state.sprint);
    if (state.module) tags.push('@' + state.module);
    const grep = tags.map((t) => `(?=.*${t}\\b)`).join('');
    const ui = list.filter((c) => c.layer === 'UI').length;
    cmdBlock($('cmd-pw'), ui ? `npx playwright test --grep "${grep}" --project=msedge --headed` : '# No UI case in this selection.');
    const api = list.filter((c) => c.layer === 'API');
    $('bru-wrap').hidden = api.length === 0;
    if (api.length) {
      cmdBlock($('cmd-bru'), `npm run serve        # in a second terminal: the API needs the demo server\ncd api-testing/lawak-store\nnpx bru run --env local -r${state.suite === 'smoke' ? ' --tags smoke' : ''} --reporter-html report.html --reporter-skip-headers "Authorization Cookie"`);
    }
    const scenario = [state.suite, state.sprint && 'sprint-' + state.sprint, state.phase && 'phase-' + state.phase, state.module].filter(Boolean).join('-');
    const cheat = [
      ['Install once', 'cd demo\nnpm ci\npython -m pip install openpyxl python-docx pillow'],
      ['Start the demo server (UI and API on port 4173)', 'npm run serve'],
      ['List the tests of this selection without running them', `npx playwright test --list --grep "${grep}"`],
      ['Run one case by ID in a visible browser', `npx playwright test -g "${(list.find((c) => c.layer === 'UI') || { id: 'TC-AUTH-001' }).id}" --project=msedge --headed`],
      ['Open the Playwright report of the last run of this scenario', `npx playwright show-report automation/scenarios/${scenario}/RunTest1/report --port 9400`],
      ['Run the same cases on a phone viewport', `npx playwright test --grep "${grep}" --project=mobile`],
      ['After a change to the test case source', 'node scripts/export-catalog.js\npython scripts/build_testcases.py\npython scripts/build_test_plan_docx.py'],
    ];
    $('cheat').innerHTML = cheat.map(([label]) => `<div><div class="cmd-label">${esc(label)}</div><pre class="cmd"></pre></div>`).join('');
    $('cheat').querySelectorAll('pre.cmd').forEach((el, i) => cmdBlock(el, cheat[i][1]));
  }

  // ---------- KPIs ----------
  function kpis(list) {
    const ui = list.filter((c) => c.layer === 'UI').length;
    $('k-selected').textContent = list.length;
    $('k-selected-sub').textContent = `${ui} UI (Playwright), ${list.length - ui} API (Bruno)`;
    const known = list.map((c) => latest[c.id] && latest[c.id].durationMs).filter((d) => d > 0);
    const avg = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 1500;
    const ms = list.reduce((s, c) => s + ((latest[c.id] && latest[c.id].durationMs) || avg), 0) + 6000;
    $('k-time').textContent = ms < 90000 ? `~${Math.round(ms / 1000)} s` : `~${(ms / 60000).toFixed(1)} min`;
    const res = list.map((c) => latest[c.id]).filter(Boolean);
    const pass = res.filter((r) => r.status === 'Pass').length;
    $('k-result').textContent = res.length ? `${pass}/${res.length}` : '-';
    $('k-result-sub').textContent = res.length ? `${res.length - pass} failed, ${list.length - res.length} not run yet` : 'Not run yet';
  }

  // ---------- cases ----------
  function renderCases(list) {
    const rows = list.filter((c) => !state.q || c.id.toLowerCase().includes(state.q) || c.title.toLowerCase().includes(state.q));
    $('cases').innerHTML = rows.length ? rows.map((c) => {
      const r = latest[c.id];
      const result = r ? `<span class="pill ${PILL[r.status] || ''}">${esc(r.status)}</span>` : '<span class="pill">Not run</span>';
      return `<tr class="case-row" data-id="${esc(c.id)}">
        <td class="mono"><button class="case-toggle" type="button" aria-expanded="false">${esc(c.id)}</button></td><td>${esc(c.title)}${r && r.issue ? ' <span class="pill bad">DEF-001</span>' : ''}</td><td>${esc(modules[c.module])}</td>
        <td>${esc(sprintName[c.sprint])}</td><td>${esc(c.layer)}</td><td>${esc(c.priority)}</td>
        <td>${c.suites.map((s) => `<span class="pill info">${esc(s)}</span>`).join(' ') || '<span class="pill">full only</span>'}</td><td>${result}</td></tr>`;
    }).join('') : '<tr><td colspan="8" class="empty">No case matches this selection.</td></tr>';
    $('cases').querySelectorAll('tr.case-row').forEach((tr) => {
      const btn = tr.querySelector('.case-toggle');
      const toggle = () => {
        const next = tr.nextElementSibling;
        if (next && next.classList.contains('case-detail')) { next.remove(); btn.setAttribute('aria-expanded', 'false'); return; }
        const c = catalog.cases.find((x) => x.id === tr.dataset.id);
        const r = latest[c.id];
        const detail = document.createElement('tr');
        detail.className = 'case-detail';
        detail.innerHTML = `<td colspan="8"><div class="grid cols-2">
          <div><strong>Steps and expected results</strong><ol class="steps">${c.steps.map((s) => `<li>${esc(s.step)}<div class="exp">Expected: ${esc(s.expect)}</div></li>`).join('')}</ol></div>
          <div class="stack"><div><strong>Scenario</strong> ${esc(c.scenario)} &middot; <strong>Type</strong> ${esc(c.type)} &middot; <strong>Tool</strong> ${esc(c.tool)}</div>
          <div><strong>Reference</strong> ${esc(c.refs)}</div><div><strong>Tags</strong> <span class="mono">${esc(c.tags.join(' '))}</span></div>
          ${r ? `<div><strong>Last run</strong> ${esc(r.run)} &middot; ${new Date(r.at).toLocaleString('en-GB')}${r.failedStep ? `<div class="pill bad" style="margin-top:6px;white-space:normal">Failed at ${esc(r.failedStep)}</div><div class="muted" style="margin-top:6px">${esc(r.note)}</div>` : ''}</div>` : ''}
          </div></div></td>`;
        tr.after(detail);
        btn.setAttribute('aria-expanded', 'true');
      };
      // The button gives keyboard and screen reader access. A click anywhere on the row also works.
      tr.addEventListener('click', toggle);
    });
  }

  // ---------- runs ----------
  function renderRuns() {
    if (!runs.length) { $('runs').innerHTML = '<div class="card empty">No run is published yet. Run the official command, then commit the docs folder.</div>'; return; }
    $('runs').innerHTML = runs.map((r, i) => {
      const t = r.totals;
      const pct = (n) => (t.cases ? (n / t.cases) * 100 : 0);
      const fails = r.cases.filter((c) => c.status === 'Fail');
      const f = r.filters || {};
      const scope = [f.phase && `Phase ${f.phase}`, f.sprint && `Sprint ${f.sprint}`, f.module && f.module.toUpperCase()].filter(Boolean).join(', ') || 'all phases, sprints and modules';
      return `<article class="card pad stack">
        <div class="row between"><div><h3 style="margin:0">${esc(r.scenario)} / ${esc(r.run)} ${i === 0 ? '<span class="pill info">latest</span>' : ''}</h3>
          <div class="muted" style="font-size:.86rem">${new Date(r.finishedAt).toLocaleString('en-GB')} &middot; ${esc(r.browser)} &middot; ${esc(scope)}</div></div>
          <div class="row"><span class="pill ok">${t.pass} pass</span><span class="pill ${t.fail ? 'bad' : ''}">${t.fail} fail</span>${t.skipped ? `<span class="pill warn">${t.skipped} skipped</span>` : ''}</div></div>
        <div class="bar" role="img" aria-label="${t.pass} of ${t.cases} cases passed"><span class="p" style="width:${pct(t.pass)}%"></span><span class="f" style="width:${pct(t.fail)}%"></span><span class="s" style="width:${pct(t.skipped)}%"></span></div>
        ${fails.length ? `<div><strong>Failures</strong><ul style="margin:6px 0 0;padding-left:18px">${fails.map((c) => `<li><span class="mono">${esc(c.id)}</span> ${esc(c.failedStep || '')}${c.issue ? ` <span class="pill bad">${esc(c.issue.split(':')[0])}</span>` : ''}<div class="muted" style="font-size:.84rem">${esc(c.note || '')}</div></li>`).join('')}</ul></div>` : ''}
        <div class="row"><code class="muted">${esc(r.command)}</code></div>
        ${r.evidence ? `<div class="row"><button class="btn small" type="button" data-preview="../${esc(r.evidence)}" data-kind="docx" data-title="${esc(r.evidence.split('/').pop())}">Preview evidence (.docx)</button><a class="btn small" href="../${esc(r.evidence)}" download>Download</a></div>` : ''}
      </article>`;
    }).join('');
  }

  // ---------- documents ----------
  function renderDocs() {
    const lastWithDoc = runs.find((r) => r.evidence);
    const docs = [
      { kind: 'docx', title: 'Test Plan', file: '../documents/LawakStore_TestPlan.docx', desc: 'Scope, approach, suites, phases and sprints, environment, entry and exit criteria, defects and traceability.' },
      { kind: 'xlsx', title: 'Test Cases workbook', file: '../documents/LawakStore_TestCases.xlsx', desc: 'Every case with steps, expected results and the latest result. One tab per sprint, plus a summary tab.' },
    ];
    if (lastWithDoc) docs.push({ kind: 'docx', title: 'Latest evidence', file: '../' + lastWithDoc.evidence, desc: `${lastWithDoc.scenario} / ${lastWithDoc.run}: status table, failure summary, and every step with its screenshot or API response.` });
    $('doc-cards').innerHTML = docs.map((d) => `<div class="card pad doc-card">
      <div class="row"><div class="doc-icon ${d.kind}">${d.kind.toUpperCase()}</div><div><h3 style="margin:0">${esc(d.title)}</h3><div class="muted mono" style="font-size:.78rem">${esc(d.file.split('/').pop())}</div></div></div>
      <p class="muted" style="margin:0;font-size:.9rem">${esc(d.desc)}</p>
      <div class="row"><button class="btn small primary" type="button" data-preview="${esc(d.file)}" data-kind="${d.kind}" data-title="${esc(d.title)}">Preview</button><a class="btn small" href="${esc(d.file)}" download>Download</a></div></div>`).join('');
  }

  async function preview(file, kind, title) {
    const viewer = $('viewer');
    $('viewer-title').textContent = 'Preview: ' + title;
    const dl = $('viewer-download');
    dl.href = file; dl.hidden = false;
    viewer.innerHTML = '<div class="empty">Loading...</div>';
    $('documents').scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const buf = await fetch(file).then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); });
      if (kind === 'docx') {
        if (!window.docx || !window.docx.renderAsync) throw new Error('The Word preview library did not load.');
        viewer.innerHTML = '';
        await window.docx.renderAsync(buf, viewer, null, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true });
      } else {
        if (!window.XLSX) throw new Error('The Excel preview library did not load.');
        const wb = window.XLSX.read(buf, { type: 'array' });
        viewer.innerHTML = `<div class="sheet-tabs" role="toolbar" aria-label="Sheets">${wb.SheetNames.map((n, i) => `<button class="btn small" type="button" aria-pressed="${i === 0}" data-sheet="${esc(n)}">${esc(n)}</button>`).join('')}</div><div class="sheet"></div>`;
        const show = (name) => {
          viewer.querySelector('.sheet').innerHTML = window.XLSX.utils.sheet_to_html(wb.Sheets[name], { header: '', footer: '' });
          viewer.querySelectorAll('[data-sheet]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sheet === name)));
        };
        viewer.querySelectorAll('[data-sheet]').forEach((b) => b.addEventListener('click', () => show(b.dataset.sheet)));
        show(wb.SheetNames[0]);
      }
    } catch (e) {
      viewer.innerHTML = `<div class="empty">The preview is not available (${esc(e.message)}). Use Download to open the file.</div>`;
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-preview]');
    if (b) preview(b.dataset.preview, b.dataset.kind, b.dataset.title);
  });

  function update() {
    saveState();
    const list = selected();
    kpis(list);
    commands(list);
    renderCases(list);
  }
  update();
  renderRuns();
  renderDocs();
})();
