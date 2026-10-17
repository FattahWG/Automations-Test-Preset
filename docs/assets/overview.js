// Overview KPI tiles: read the real catalog and the newest run.
(async () => {
  try {
    const [cat, runs] = await Promise.all([
      fetch('dashboard/data/catalog.json').then((r) => r.json()),
      fetch('dashboard/data/runs.json').then((r) => r.json()).catch(() => []),
    ]);
    const ui = cat.cases.filter((c) => c.layer === 'UI').length;
    document.getElementById('k-cases').textContent = cat.cases.length;
    document.getElementById('k-split').textContent = `${ui} UI, ${cat.cases.length - ui} API`;
    document.getElementById('k-smoke').textContent = cat.cases.filter((c) => c.suites.includes('smoke')).length;
    if (runs[0]) {
      const t = runs[0].totals;
      document.getElementById('k-last').textContent = `${t.pass}/${t.cases}`;
      document.getElementById('k-last-sub').textContent = `${runs[0].scenario}, ${new Date(runs[0].finishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
    }
  } catch (e) { /* the numbers stay as dashes */ }
})();
