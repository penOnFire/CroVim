import { test, expect } from './extension-fixtures';

test('content script exposes hints, help, find, text input Escape, and scrolling controls', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/rich.html');
  await page.waitForTimeout(250);
  await page.keyboard.press('f');
  await expect(page.locator('#crovim-ui-root').locator('.hint-label')).toHaveCount(0);
  await page.keyboard.press('Shift+F');
  await expect(page.locator('#crovim-ui-root')).toBeAttached();
  await expect(page.locator('#crovim-ui-root').locator('.hint-label')).not.toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#crovim-ui-root').locator('.hint-label')).toHaveCount(0);

  // Focus text input, type keys (should not trigger hints/scroll), then press Escape to exit input
  const searchBox = page.locator('#search-box');
  await searchBox.click();
  await page.keyboard.type('fjk');
  await expect(searchBox).toHaveValue('fjk');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).not.toBe('search-box');

  // After escaping text input, Shift+F immediately activates link hints and typing a hint combination closes hints automatically
  await page.keyboard.press('Shift+F');
  const labels = page.locator('#crovim-ui-root').locator('.hint-label');
  await expect(labels).not.toHaveCount(0);
  const lastLabel = (await labels.last().textContent())?.trim() ?? 'a';
  await page.keyboard.type(lastLabel);
  await expect(labels).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.keyboard.press('?');
  const help = page.locator('#crovim-ui-root').locator('.help-dialog');
  await expect(help).toBeVisible();
  await help.press('Escape');
  await page.keyboard.press('/');
  const findInput = page.locator('#crovim-ui-root').locator('input[aria-label="Find in page"]');
  await expect(findInput).toBeVisible();
  await page.keyboard.type('Findable');
  await expect(findInput).toHaveValue('Findable');
  await page.keyboard.press('Escape');

  // Verify Chrome shortcuts like Ctrl+1..9 are never prevented by CroVim
  const ctrlDigitPrevented = await page.evaluate(() => {
    const ev = new KeyboardEvent('keydown', { key: '1', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(ctrlDigitPrevented).toBe(false);

  await page.keyboard.press('j');
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});
