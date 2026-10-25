import { test, expect } from './extension-fixtures';
test('options page has accessible form controls for mode preferences', async ({ context, extensionId }) => {
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
  await expect(page.getByText('Scroll step')).toBeVisible(); await expect(page.getByText('Hint characters')).toBeVisible();
});
