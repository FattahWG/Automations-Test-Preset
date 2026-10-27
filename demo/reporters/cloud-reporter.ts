// Sends a run to the QA Lab on fattahwg.github.io, so visitors can watch it live and replay it.
// Active only when BACKEND_URL and RUNNER_TOKEN are set (GitHub Actions). In a local run it does nothing.
// Every hook adds a task to one queue, so events arrive in order and a `step` event goes out
// after its screenshot is stored. A failed upload never fails a test.
// The live view frames come from the liveView fixture in tests/support/case.fixture.ts.
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult, TestStep } from '@playwright/test/reporter';

// Same contract as packages/shared/src/runner.ts in the portfolio repo.
type RunnerEvent =
  | { type: 'run.started'; githubRunId?: number; githubRunUrl?: string; total?: number }
  | { type: 'test.begin'; testId: string; tcId: string; title: string; file: string }
  | { type: 'step'; testId: string; index: number; label: string; screenshotKey?: string }
  | { type: 'log'; seq: number; level: 'info' | 'error'; message: string }
  | { type: 'test.end'; testId: string; status: 'passed' | 'failed' | 'skipped'; durationMs: number; error?: string; videoKey?: string }
  | { type: 'run.finished'; status: 'passed' | 'failed' | 'cancelled'; passed: number; failed: number; skipped: number; durationMs: number };

const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const RUNNER_TOKEN = process.env.RUNNER_TOKEN || '';
const PROJECT = 'lawak-store';
const FLUSH_INTERVAL_MS = 1000;
const MAX_BATCH = 100;
const ANSI = /\u001b\[[0-9;]*m/g;
// The last workflow step reads this file to close the run when the job stops early.
export const RUN_ID_FILE = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'qa-lab-run-id');

function githubRun(): { githubRunId?: number; githubRunUrl?: string } {
  const { GITHUB_RUN_ID, GITHUB_SERVER_URL, GITHUB_REPOSITORY } = process.env;
  if (!GITHUB_RUN_ID || !GITHUB_SERVER_URL || !GITHUB_REPOSITORY) return {};
  return { githubRunId: Number(GITHUB_RUN_ID), githubRunUrl: `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` };
}

/** "TC-CART-001 Add a product to the cart" → case ID and title. */
function splitTitle(title: string): { tcId: string; name: string } {
  const match = title.match(/^(TC-[A-Z]+-\d+)\s+(.*)$/);
  return match ? { tcId: match[1], name: match[2] } : { tcId: '', name: title };
}

/** "[UI] TC-CART-001 S01 Select Add to cart" → "S01 Select Add to cart". */
function stepLabel(title: string): string {
  return title.replace(/^\[(UI|API)\]\s+TC-[A-Z]+-\d+\s+/, '').replace(/\s+/g, ' ').trim();
}

class CloudReporter implements Reporter {
  private enabled = Boolean(BACKEND_URL && RUNNER_TOKEN);
  private runId = process.env.RUN_ID || '';
  private queue: Promise<void> = Promise.resolve();
  private pending: RunnerEvent[] = [];
  private timer: NodeJS.Timeout | undefined;
  private suite: Suite | undefined;
  private logSeq = 0;
  private startedAt = 0;
  private stepIndex = new Map<string, number>();
  private claimedShots = new Map<string, number>();

  printsToStdio(): boolean {
    return false;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    if (!this.enabled) return;
    this.suite = suite;
    this.startedAt = Date.now();
    this.enqueue(async () => {
      if (!this.runId) await this.createRun();
      if (!this.runId) return;
      fs.writeFileSync(RUN_ID_FILE, this.runId);
      this.push({ type: 'run.started', total: suite.allTests().length, ...githubRun() });
      await this.flush();
    });
    this.timer = setInterval(() => this.enqueue(() => this.flush()), FLUSH_INTERVAL_MS);
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    if (!this.enabled) return;
    const { tcId, name } = splitTitle(test.title);
    const retry = result.retry ? ` (retry ${result.retry})` : '';
    this.push({
      type: 'test.begin',
      testId: this.testId(test, result),
      tcId: `${tcId}${result.retry ? `-R${result.retry + 1}` : ''}`,
      title: `${name}${retry}`,
      file: path.relative(process.cwd(), test.location.file).replace(/\\/g, '/'),
    });
    this.log('info', `▶ ${test.title}${retry}`);
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    if (!this.enabled) return;
    if (step.category === 'test.step' || step.category === 'expect') {
      const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(2);
      const duration = step.duration ? ` (${(step.duration / 1000).toFixed(2)}s)` : '';
      this.log(step.error ? 'error' : 'info', `+${elapsed}s ${step.error ? '✘' : '✔'} ${step.title.replace(/\s+/g, ' ').trim()}${duration}`);
      if (step.error?.message) this.log('error', `   ↳ ${step.error.message.replace(ANSI, '').split('\n')[0]}`);
    }
    // One QA Lab step per case step: the caseStep fixture makes a top-level test.step with a screenshot.
    if (step.category !== 'test.step' || step.parent) return;

    const testId = this.testId(test, result);
    const shot = this.claimShot(testId, step, result);
    const label = stepLabel(step.title);
    this.enqueue(async () => {
      const index = (this.stepIndex.get(testId) ?? 0) + 1;
      this.stepIndex.set(testId, index);
      // Only a failed step keeps its screenshot (the backend deletes it after 1 day). The live view shows the rest.
      const evidence = step.error ? shot : undefined;
      const data = evidence?.body ?? (evidence?.path && fs.existsSync(evidence.path) ? fs.readFileSync(evidence.path) : undefined);
      const key = data ? await this.upload(`${testId}/step-${String(index).padStart(2, '0')}.png`, data, 'image/png') : undefined;
      this.push({ type: 'step', testId, index, label, screenshotKey: key });
    });
  }

  onStdOut(chunk: string | Buffer): void {
    if (!this.enabled) return;
    for (const line of chunk.toString().split('\n').filter(Boolean)) this.log('info', line);
  }

  onStdErr(chunk: string | Buffer): void {
    if (!this.enabled) return;
    for (const line of chunk.toString().split('\n').filter(Boolean)) this.log('error', line);
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (!this.enabled) return;
    const testId = this.testId(test, result);
    const status = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    this.log(status === 'failed' ? 'error' : 'info', `${status === 'passed' ? '✓' : status === 'failed' ? '✘' : '–'} ${test.title} (${(result.duration / 1000).toFixed(1)}s)`);

    this.enqueue(async () => {
      this.push({
        type: 'test.end',
        testId,
        status,
        durationMs: result.duration,
        error: result.error?.message?.replace(ANSI, '').split('\n').slice(0, 12).join('\n'),
      });
      await this.flush();
    });
  }

  async onEnd(result: FullResult): Promise<void> {
    if (!this.enabled) return;
    clearInterval(this.timer);
    const counts = { passed: 0, failed: 0, skipped: 0 };
    for (const test of this.suite?.allTests() ?? []) {
      const outcome = test.outcome();
      if (outcome === 'expected' || outcome === 'flaky') counts.passed += 1;
      else if (outcome === 'unexpected') counts.failed += 1;
      else counts.skipped += 1;
    }
    const status = result.status === 'passed' ? 'passed' : result.status === 'interrupted' ? 'cancelled' : 'failed';
    this.enqueue(async () => {
      this.push({ type: 'run.finished', status, ...counts, durationMs: Math.round(result.duration) });
      await this.flush();
    });
    await this.queue;
  }

  /**
   * The screenshot of a case step. caseStep attaches it in a `finally` block, so Playwright puts it on the
   * test result, not on the step. Take the newest PNG that no earlier step took.
   */
  private claimShot(testId: string, step: TestStep, result: TestResult): TestResult['attachments'][number] | undefined {
    const own = step.attachments.find((a) => a.contentType === 'image/png' && (a.body || a.path));
    if (own) return own;
    const from = this.claimedShots.get(testId) ?? 0;
    const pngs = result.attachments.filter((a) => a.contentType === 'image/png' && (a.body || a.path));
    this.claimedShots.set(testId, pngs.length);
    return pngs.length > from ? pngs[pngs.length - 1] : undefined;
  }

  private testId(test: TestCase, result: TestResult): string {
    return `${test.id}-${result.retry}`;
  }

  private log(level: 'info' | 'error', message: string): void {
    this.logSeq += 1;
    this.pending.push({ type: 'log', seq: this.logSeq, level, message: message.replace(ANSI, '') });
  }

  private push(event: RunnerEvent): void {
    this.pending.push(event);
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((err) => console.error(`[qa-lab] ${(err as Error).message}`));
  }

  private async request(method: string, url: string, body: string | Buffer, contentType: string): Promise<Response | null> {
    try {
      return await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${RUNNER_TOKEN}`, 'Content-Type': contentType },
        body: typeof body === 'string' ? body : new Uint8Array(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      console.error(`[qa-lab] ${method} ${url.replace(BACKEND_URL, '')} failed: ${(err as Error).message}`);
      return null;
    }
  }

  private async createRun(): Promise<void> {
    const trigger = process.env.RUN_TRIGGER === 'schedule' ? 'schedule' : 'owner';
    const response = await this.request('POST', `${BACKEND_URL}/api/runner/runs`, JSON.stringify({ project: PROJECT, trigger }), 'application/json');
    if (response?.ok) {
      this.runId = ((await response.json()) as { runId: string }).runId;
      return;
    }
    // For example 409: another run is active. The tests still run; the QA Lab does not get them.
    console.error(`[qa-lab] cannot create a run (${response?.status ?? 'network error'}); results are not reported`);
    this.enabled = false;
    clearInterval(this.timer);
  }

  private async flush(): Promise<void> {
    if (!this.runId) return;
    while (this.pending.length) {
      const events = this.pending.splice(0, MAX_BATCH);
      const response = await this.request('POST', `${BACKEND_URL}/api/runner/events`, JSON.stringify({ runId: this.runId, events }), 'application/json');
      if (!response?.ok) console.error(`[qa-lab] events rejected (${response?.status ?? 'network error'})`);
    }
  }

  private async upload(name: string, data: Buffer, contentType: string): Promise<string | undefined> {
    const key = `runs/${this.runId}/${name}`;
    const response = await this.request('PUT', `${BACKEND_URL}/api/runner/artifacts/${key}`, data, contentType);
    if (response?.ok) return key;
    console.error(`[qa-lab] upload ${name} rejected (${response?.status ?? 'network error'})`);
    return undefined;
  }
}

export default CloudReporter;
