import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30000,
  use: { browserName: 'chromium', headless: true, baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'node --experimental-strip-types tests/server.ts', url: 'http://127.0.0.1:4173', reuseExistingServer: true },
});
