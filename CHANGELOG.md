# Changelog

Every push adds a dated entry below, newest first: what changed, where, and why.

## 2026-10-28: QA Lab picker, live view, API runs and Word evidence

### What

- The QA Lab workflow takes the visitor's choice: suite `ui` or `api`, a list of case IDs, and a label (smoke, regression, custom or api). It checks the inputs again before it runs.
- Visitor runs show a live view: the page sends one JPEG every 2 seconds to the same key. Each UI step pauses 2.5 seconds, so a visitor can follow it. No more videos.
- Only a failed step uploads its screenshot. The backend keeps it for 1 day.
- Visitors can run the Bruno API suite. Its requests and checks stream live as tests and steps. Each request pauses 2.5 seconds.
- Each QA Lab run builds the Word evidence document (the same builder as `run-suite.js`) and uploads it for download.

### Where

- `.github/workflows/e2e-lawak-store.yml`: inputs `suite`, `cases`, `label`; the API step; the evidence step.
- `demo/tests/support/case.fixture.ts`: `liveView` fixture and the step pause. `demo/playwright.config.ts`: no video, longer timeout with the pause.
- `demo/reporters/cloud-reporter.ts`: failed-step screenshots only.
- `demo/scripts/qa-lab-api.mjs`: the live Bruno run. `demo/api-testing/lawak-store/collection.bru`: the pause before each request.
- `demo/scripts/qa-lab-evidence.js`: the Word evidence upload.

### Why

- Videos and step screenshots used too much of the R2 free tier. The live view stores one small file while the run is active.
- Visitors can choose what to test, like in a real QA team.

## 2026-10-25: QA Lab runner

### What

- The Lawak Store UI suite can run on GitHub Actions for the QA Lab on fattahwg.github.io, which shows each step, screenshot, log line, and video live.

### Where

- `.github/workflows/e2e-lawak-store.yml`: starts from the QA Lab (`run_id` input) or every day at 08:00 WIB. Runs `--grep @regression` in Chromium against the local demo server.
- `demo/reporters/cloud-reporter.ts`: sends the run to the QA Lab API. Off unless `BACKEND_URL` and `RUNNER_TOKEN` are set.
- `demo/playwright.config.ts`: adds the reporter, and records video only in CI with a QA Lab backend.
- `demo/README.md`: a QA Lab runner section.

### Why

- Visitors of the portfolio can run the real suite and see the result, including the planted defect DEF-001.
