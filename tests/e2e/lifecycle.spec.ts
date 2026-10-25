import { test, expect } from './extension-fixtures';
test('extension can reopen its options page after worker access', async ({ context, extensionId }) => {
  const first = await context.newPage(); await first.goto(`chrome-extension://${extensionId}/pages/options.html`);
  await expect(first).toHaveTitle(/CroVim/i);
  await first.close();
  const second = await context.newPage(); await second.goto(`chrome-extension://${extensionId}/pages/options.html`);
  await expect(second.getByRole('heading', { name: 'CroVim Options' })).toBeVisible();
});
