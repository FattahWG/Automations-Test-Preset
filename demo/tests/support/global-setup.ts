import { request, type FullConfig } from '@playwright/test';

// Start every run from the seed data, so counts like "11 products" are stable.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL as string;
  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/demo/reset');
  if (!res.ok()) throw new Error(`Demo reset failed: HTTP ${res.status()}`);
  await ctx.dispose();
}
