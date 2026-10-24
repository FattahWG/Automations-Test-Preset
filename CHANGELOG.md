# Changelog

Every push adds a dated entry below, newest first: what changed, where, and why.

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
