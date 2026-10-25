import { test, expect } from './extension-fixtures';
test('options exposes validated settings controls', async ({ context, extensionId }) => {
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/pages/options.html`);
  const step = page.locator('input[name="scrollStep"]'); await expect(step).toHaveValue('400');
  await step.fill('999'); await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('output')).toContainText('Saved');
});
