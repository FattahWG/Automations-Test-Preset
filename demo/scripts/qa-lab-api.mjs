// Runs the Bruno API collection for the QA Lab and streams it live, like the Playwright cloud reporter.
// Each "TC-..." request is one test; each check under it is one step. Setup requests show only in the log.
// Needs BACKEND_URL and RUNNER_TOKEN. RUN_ID comes from the QA Lab; without it the script makes its own run.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(fs.readFileSync(path.join(here, '../test-cases/catalog.json'), 'utf8'));
const BACKEND_URL = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const RUNNER_TOKEN = process.env.RUNNER_TOKEN || '';
const RUN_ID_FILE = path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'qa-lab-run-id');
const ANSI = /\u001b\[[0-9;]*m/g;
const REQUEST_LINE = /^\d{3}-(.+?) \((.+)\) - (\d+) ms$/;
const CASE_ID = /TC-[A-Z]+-\d{3}/;
const API_CASES = Object.keys(catalog).filter((id) => catalog[id].tags.includes('@api'));

let runId = process.env.RUN_ID || '';
let logSeq = 0;
let pending = [];
let current = null;
const counts = { passed: 0, failed: 0, skipped: 0 };
const startedAt = Date.now();

async function call(method, url, body) {
  try {
    return await fetch(`${BACKEND_URL}${url}`, {
      method,
      headers: { Authorization: `Bearer ${RUNNER_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    console.error(`[qa-lab] ${method} ${url} failed: ${err.message}`);
    return null;
  }
}

async function flush() {
  while (runId && pending.length) {
    const events = pending.splice(0, 100);
    const response = await call('POST', '/api/runner/events', { runId, events });
    if (!response?.ok) console.error(`[qa-lab] events rejected (${response?.status ?? 'network error'})`);
  }
}

const log = (level, message) => pending.push({ type: 'log', seq: ++logSeq, level, message });

function endCase() {
  if (!current) return;
  const status = current.failed ? 'failed' : 'passed';
  counts[status] += 1;
  pending.push({ type: 'test.end', testId: current.testId, status, durationMs: Date.now() - current.started, error: current.errors.join('\n') || undefined });
  log(status === 'failed' ? 'error' : 'info', `${status === 'passed' ? '✓' : '✘'} ${current.tcId} (${((Date.now() - current.started) / 1000).toFixed(1)}s)`);
  current = null;
}

function onLine(raw) {
  const line = raw.replace(ANSI, '').trimEnd();
  if (!line.trim()) return;
  console.log(line);
  const request = line.match(REQUEST_LINE);
  if (request) {
    endCase();
    const tcId = request[1].match(CASE_ID)?.[0];
    if (tcId) {
      current = { tcId, testId: `${tcId}-api`, started: Date.now(), step: 0, failed: false, errors: [] };
      pending.push({ type: 'test.begin', testId: current.testId, tcId, title: catalog[tcId]?.title ?? request[1], file: `api-testing/lawak-store/${request[1]}.bru` });
      log('info', `▶ ${tcId} ${catalog[tcId]?.title ?? ''}`);
    }
    log('info', `→ ${request[1]}: ${request[2]} in ${request[3]} ms`);
    if (current) pending.push({ type: 'step', testId: current.testId, index: ++current.step, label: `Request: ${request[2]} in ${request[3]} ms` });
    return;
  }
  const check = line.match(/^\s*([✓✗✔✘])\s+(.+)$/);
  if (check) {
    const ok = check[1] === '✓' || check[1] === '✔';
    log(ok ? 'info' : 'error', `  ${ok ? '✔' : '✘'} ${check[2]}`);
    if (current) {
      pending.push({ type: 'step', testId: current.testId, index: ++current.step, label: `${ok ? 'Pass' : 'Fail'}: ${check[2]}` });
      if (!ok) {
        current.failed = true;
        current.errors.push(check[2]);
      }
    }
    return;
  }
  if (/Execution Summary/.test(line)) endCase();
}

if (!BACKEND_URL || !RUNNER_TOKEN) {
  console.error('[qa-lab] BACKEND_URL and RUNNER_TOKEN are required');
  process.exit(1);
}
if (!runId) {
  const trigger = process.env.RUN_TRIGGER === 'schedule' ? 'schedule' : 'owner';
  const response = await call('POST', '/api/runner/runs', { project: 'lawak-store', trigger });
  if (!response?.ok) {
    console.error(`[qa-lab] cannot create a run (${response?.status ?? 'network error'})`);
    process.exit(1);
  }
  runId = (await response.json()).runId;
}
fs.writeFileSync(RUN_ID_FILE, runId);
pending.push({ type: 'run.started', total: API_CASES.length });
log('info', `Bruno API suite: ${API_CASES.length} cases, one request each, plus setup requests`);
await flush();
const timer = setInterval(() => void flush(), 1000);

// The JSON report feeds the Word evidence document (qa-lab-evidence.js reads RUN_DIR/bruno/results.json).
const runDir = path.resolve(here, '..', process.env.RUN_DIR || 'automation/last-run');
fs.mkdirSync(path.join(runDir, 'bruno'), { recursive: true });
const bru = spawn('npx', ['bru', 'run', '-r', '--env', 'local', '--reporter-json', `"${path.join(runDir, 'bruno', 'results.json')}"`, '--reporter-skip-headers', '"Authorization Cookie"'], { cwd: path.join(here, '../api-testing/lawak-store'), shell: true, env: process.env });
let buffer = '';
const feed = (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop();
  lines.forEach(onLine);
};
bru.stdout.on('data', feed);
bru.stderr.on('data', feed);
const code = await new Promise((resolve) => bru.on('close', resolve));
if (buffer) onLine(buffer);
endCase();

clearInterval(timer);
const status = code === 0 && counts.failed === 0 ? 'passed' : 'failed';
pending.push({ type: 'run.finished', status, ...counts, durationMs: Date.now() - startedAt });
await flush();
process.exit(status === 'passed' ? 0 : 1);
