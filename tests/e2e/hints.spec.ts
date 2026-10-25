import { test, expect } from './extension-fixtures';
test('popup and options are loadable extension pages', async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
  await expect(page.getByRole('heading', { name: 'CroVim Options' })).toBeVisible();
  await expect(page.locator('input[name="hintCharacters"]')).toBeVisible();
});
