// caseStep fixture: one test per case ID, one step per case step.
// Each step is a test.step with evidence: a full-page screenshot for UI steps, a redacted JSON for API steps.
import { test as base, expect, type APIResponse } from '@playwright/test';
import catalog from '../../test-cases/catalog.json';

type Kind = 'UI' | 'API';
type StepFn = (kind: Kind, title: string, body: () => Promise<APIResponse | string | void>) => Promise<void>;

const REDACT = ['authorization', 'cookie', 'set-cookie', 'x-api-key'];
const redact = (h: Record<string, string>) =>
  Object.fromEntries(Object.entries(h).map(([k, v]) => [k, REDACT.includes(k.toLowerCase()) ? '***' : v]));

/** Tags come from the catalog, so the dashboard filters and the --grep commands always match the cases. */
export function tagsFor(id: string): string[] {
  const c = (catalog as any)[id];
  if (!c) throw new Error(`${id} is not in test-cases/catalog.json. Run: node scripts/export-catalog.js`);
  return c.tags;
}

// QA Lab visitor runs only (GitHub Actions sets these). A local run has no pause and no live frames.
const STEP_DELAY_MS = Number(process.env.QA_LAB_STEP_DELAY_MS || 0);
const LIVE_MS = Number(process.env.QA_LAB_LIVE_MS || 0);
const LIVE_URL =
  LIVE_MS && process.env.BACKEND_URL && process.env.RUNNER_TOKEN && process.env.RUN_ID
    ? `${process.env.BACKEND_URL.replace(/\/$/, '')}/api/runner/artifacts/runs/${process.env.RUN_ID}/live.jpg`
    : '';

export const test = base.extend<{ caseStep: StepFn; liveView: void }>({
  // One JPEG of the page every LIVE_MS, always to the same key: the QA Lab shows it as a live view.
  liveView: [
    async ({ page }, use) => {
      if (!LIVE_URL) return use();
      let running = true;
      const loop = (async () => {
        while (running) {
          try {
            const body = await page.screenshot({ type: 'jpeg', quality: 55 });
            await fetch(LIVE_URL, {
              method: 'PUT',
              headers: { Authorization: `Bearer ${process.env.RUNNER_TOKEN}`, 'Content-Type': 'image/jpeg' },
              body: new Uint8Array(body),
              signal: AbortSignal.timeout(10_000),
            });
          } catch {
            // The page is closing or the upload failed: the next frame tries again.
          }
          await new Promise((resolve) => setTimeout(resolve, LIVE_MS));
        }
      })();
      await use();
      running = false;
      await loop;
    },
    { auto: true },
  ],
  caseStep: async ({ page }, use, testInfo) => {
    const caseId = testInfo.title.split(' ')[0];
    const expected = (catalog as any)[caseId]?.steps?.length;
    let n = 0;
    await use(async (kind, title, body) => {
      const no = String(++n).padStart(2, '0');
      await base.step(`[${kind}] ${caseId} S${no} ${title}`, async () => {
        try {
          const out = await body();
          // A short pause after each UI step, so a visitor can follow the live view.
          if (kind === 'UI' && STEP_DELAY_MS) await page.waitForTimeout(STEP_DELAY_MS);
          if (typeof out === 'string') testInfo.annotations.push({ type: `actual-S${no}`, description: out });
          if (kind === 'API' && out && typeof out !== 'string') {
            await testInfo.attach(`${caseId}_${no}-API.json`, {
              contentType: 'application/json',
              body: JSON.stringify({ url: out.url(), status: out.status(), headers: redact(out.headers()), body: await out.text() }, null, 2),
            });
          }
        } finally {
          if (kind === 'UI') {
            await testInfo.attach(`${caseId}_${no}-UI.png`, { contentType: 'image/png', body: await page.screenshot({ fullPage: true }) });
          }
        }
      }, { box: true });
    });
    if (expected !== undefined && testInfo.status === testInfo.expectedStatus) {
      expect(n, `Script ${caseId} has ${n} steps, the test case has ${expected}. Update the script.`).toBe(expected);
    }
  },
});
export { expect };
