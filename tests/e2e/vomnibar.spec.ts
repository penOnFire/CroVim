import { test, expect } from './extension-fixtures';
test('vomnibar page accepts a query and renders result region', async ({ context, extensionId }) => {
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/pages/vomnibar.html`);
  await expect(page.locator('#query')).toBeVisible(); await page.locator('#query').fill('example');
  await expect(page.locator('#results')).toBeAttached();
});
