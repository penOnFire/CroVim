import { test, expect } from './extension-fixtures';
test('service worker is running and popup renders', async ({ context, extensionId }) => {
  expect(context.serviceWorkers().some((worker) => new URL(worker.url()).host === extensionId)).toBe(true);
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/pages/popup.html`);
  await expect(page.getByRole('heading', { name: 'CroVim' })).toBeVisible();
});
