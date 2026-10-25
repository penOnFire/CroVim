import { test as base, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';
export const test = base.extend<{ context: BrowserContext; extensionId: string }>({
  context: async ({}, use, testInfo) => {
    const dist = path.resolve('dist'); const profile = testInfo.outputPath('profile');
    const context = await chromium.launchPersistentContext(profile, { channel: 'chromium', args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`] });
    await use(context); await context.close();
  },
  extensionId: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    await use(new URL(worker.url()).host);
  },
});
export { expect } from '@playwright/test';
