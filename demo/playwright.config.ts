import { defineConfig, devices } from '@playwright/test';
import env from './config/environment.json';

const RUN_DIR = process.env.RUN_DIR ?? 'automation/last-run';

export default defineConfig({
  testDir: './tests',
  outputDir: `${RUN_DIR}/artifacts`,
  globalSetup: './tests/support/global-setup.ts',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // one shared demo backend: keep the order of data changes predictable
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: `${RUN_DIR}/report`, open: 'never' }],
    ['json', { outputFile: `${RUN_DIR}/results.json` }],
    ['junit', { outputFile: `${RUN_DIR}/junit.xml` }],
    // Sends the run to the QA Lab on the portfolio. It does nothing without BACKEND_URL and RUNNER_TOKEN.
    ['./reporters/cloud-reporter.ts'],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? env.baseUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // The QA Lab shows a video per test. Local runs keep the old behavior.
    video: process.env.CI && process.env.BACKEND_URL ? 'on' : 'off',
    locale: 'en-GB',
  },
  webServer: {
    command: 'node server/server.js',
    url: `${env.baseUrl}/store/`,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, default: false },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, default: false },
  ],
});
