# Lawak Store QA Demo

This folder holds the test automation for **Lawak Store**, a demo shop with an admin panel.

- Live site: <https://fattahwg.github.io/Automations-Test-Preset/>
- Demo store: <https://fattahwg.github.io/Automations-Test-Preset/store/>
- Test dashboard: <https://fattahwg.github.io/Automations-Test-Preset/dashboard/>

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin (can also shop) | `login@demo.com` | `Logindemo123` |
| Customer | `customer@demo.com` | `Customer123` |
| Disabled customer | `budi@demo.com` | `Budi12345` |

Mock cards: `4242 4242 4242 4242` is approved. `4000 0000 0000 0002` is declined. These are demo values only.

## What is here

| Path | Contents |
|---|---|
| `test-cases/source/lawak-store.json` | The single source of every test case: phases, sprints, modules, suites, steps and expected results |
| `test-cases/catalog.json` | Generated. The Playwright fixture reads it for step counts and tags |
| `test-cases/LawakStore_TestCases.xlsx` | Generated. One tab per sprint, a summary tab, and the latest result of each case |
| `tests/ui/*.spec.ts` | 41 Playwright UI cases. One test per case ID, one `caseStep` per case step |
| `tests/support/` | `caseStep` fixture, helpers, global reset |
| `api-testing/lawak-store/` | Bruno CLI collection: 9 API cases plus setup and cleanup requests |
| `scripts/run-suite.js` | The official run: new `RunTestN`, Playwright, Bruno, evidence, workbook, dashboard |
| `scripts/build_evidence_docx.py` | Word evidence per run: status table, failure summary, every step with its screenshot or API response |
| `scripts/build_testcases.py` | Excel workbook from the source and the latest results |
| `scripts/build_test_plan_docx.py` | Word test plan from the source |
| `scripts/publish-dashboard.js` | Copies the run summary and documents to `../docs` for GitHub Pages |
| `server/server.js` | Local server: the site from `../docs` and the API on `/api`, port 4173 |

The store backend is one file, `../docs/store/js/backend.js`. On GitHub Pages it runs in the browser with `localStorage`. On the local server it runs in Node with memory. So the UI tests and the API tests check the same business rules.

## Suites, phases, sprints and modules

| Suite | Contents | Command |
|---|---|---|
| Smoke | Cases tagged `smoke` (UI and API) | `node scripts/run-suite.js --suite smoke` |
| Regression | Every UI case | `node scripts/run-suite.js --suite regression` |
| Full Cycle | Every UI case and every API case | `node scripts/run-suite.js --suite full` |

Add `--phase <n>`, `--sprint <n>` or `--module <code>` to narrow a suite, for example:

```powershell
node scripts/run-suite.js --suite regression --sprint 2 --module chk
```

| Phase | Sprints | Modules |
|---|---|---|
| Phase 1 - MVP storefront | Sprint 1, Sprint 2 | Authentication, Catalog, Cart, Checkout, Customer Orders |
| Phase 2 - Admin panel | Sprint 3, Sprint 4 | Admin Products, Admin Orders, Admin Users, Admin Dashboard |

Each case gets its tags from the catalog, for example `@smoke @regression @chk @sprint-2 @phase-1 @ui`. The test dashboard builds the `--grep` command for any choice.

## Setup (Windows, PowerShell)

1. Install Node.js 22 LTS or newer, Python 3.11 or newer, and Microsoft Edge.
2. Install the packages:

   ```powershell
   cd demo
   npm ci
   python -m pip install openpyxl python-docx pillow
   ```

3. Create `api-testing/lawak-store/.env` from `.env.example`. Use the demo passwords in the table above.
4. Run the smoke suite:

   ```powershell
   node scripts/run-suite.js --suite smoke
   ```

The run starts the demo server by itself. The results go to `automation/scenarios/<scenario>/RunTestN/`. Git ignores that folder.

## After a run

1. Open the Playwright report: `npx playwright show-report automation/scenarios/<scenario>/RunTestN/report --port 9400`.
2. Open the Word evidence in the same run folder.
3. Commit `../docs` to publish the run to the dashboard. `run-suite.js` already copied the summary and the documents there.

Add `--no-publish` to keep a run local only.

## QA Lab runner

The QA Lab on <https://fattahwg.github.io/lab> runs the UI suite here on GitHub Actions and shows it live.

- `.github/workflows/e2e-lawak-store.yml` runs every UI case in Chromium against the local demo server. The QA Lab starts it with a `run_id`; it also runs every day at 08:00 WIB.
- `reporters/cloud-reporter.ts` sends the events, the step screenshots, and an mp4 video per test to the QA Lab API. It does nothing unless `BACKEND_URL` and `RUNNER_TOKEN` are set, so local runs do not change.
- The repository needs the secret `RUNNER_TOKEN` and the variable `QA_LAB_BACKEND_URL`.

## Known defect (planted on purpose)

**DEF-001.** Checkout accepts a 4-digit postal code. Rule R-07 needs exactly 5 digits. `TC-CHK-006` fails until the rule is fixed in `backend.js` (`validateCheckout`). The defect shows how a failure moves through the evidence document, the workbook and the dashboard.

## Test data rules

- Every run starts from the seed data (`tests/support/global-setup.ts` calls `POST /api/demo/reset`).
- Tests make their own data with the prefix `qa-auto` and delete the products they create.
- Only the local demo server is a target. Never point this suite at a production system.
