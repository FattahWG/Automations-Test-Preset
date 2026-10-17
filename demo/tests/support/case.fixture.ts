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

export const test = base.extend<{ caseStep: StepFn }>({
  caseStep: async ({ page }, use, testInfo) => {
    const caseId = testInfo.title.split(' ')[0];
    const expected = (catalog as any)[caseId]?.steps?.length;
    let n = 0;
    await use(async (kind, title, body) => {
      const no = String(++n).padStart(2, '0');
      await base.step(`[${kind}] ${caseId} S${no} ${title}`, async () => {
        try {
          const out = await body();
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
