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

test('content script detects modal controls and clicks buttons inside modal dialogs', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/rich.html');
  await page.waitForTimeout(250);

  // Inject a modal dialog with action button and SVG close button
  await page.evaluate(() => {
    const backdrop = document.createElement('div');
    backdrop.id = 'test-modal-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    backdrop.innerHTML = `
      <div id="test-modal" role="dialog" aria-modal="true" style="background:#fff;padding:24px;border-radius:8px;z-index:100000;min-width:300px;">
        <button id="modal-close-btn" style="float:right;">
          <svg id="modal-close-svg" viewBox="0 0 24 24" width="16" height="16"><path id="modal-close-path" d="M0 0 L16 16"/></svg>
        </button>
        <h3>Modal Dialog</h3>
        <button id="modal-confirm-btn">Confirm Modal Action</button>
      </div>
    `;
    document.body.appendChild(backdrop);
    (window as any).modalConfirmed = false;
    document.getElementById('modal-confirm-btn')?.addEventListener('click', () => {
      (window as any).modalConfirmed = true;
    });
    document.getElementById('modal-close-btn')?.addEventListener('click', () => {
      backdrop.remove();
    });
  });

  // Activate hints
  await page.keyboard.press('Shift+F');
  const labels = page.locator('#crovim-ui-root').locator('.hint-label');
  await expect(labels).not.toHaveCount(0);

  // Find the hint for modal-confirm-btn
  const confirmHint = await page.evaluate(() => {
    const root = document.getElementById('crovim-ui-root');
    const shadow = root?.shadowRoot;
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const r = confirmBtn?.getBoundingClientRect();
    if (!r) return null;
    const items = Array.from(shadow?.querySelectorAll('.hint-label') ?? []);
    for (const l of items) {
      const top = parseFloat((l as HTMLElement).style.top);
      const left = parseFloat((l as HTMLElement).style.left);
      if (Math.abs(top - r.top) < 10 && Math.abs(left - r.left) < 10) {
        return l.textContent?.trim();
      }
    }
    return null;
  });

  expect(confirmHint).toBeTruthy();
  await page.keyboard.type(confirmHint!);

  // Verify modal action fired
  await expect.poll(() => page.evaluate(() => (window as any).modalConfirmed)).toBe(true);

  // Now test closing the modal via close button hint
  await page.keyboard.press('Shift+F');
  const closeHint = await page.evaluate(() => {
    const root = document.getElementById('crovim-ui-root');
    const shadow = root?.shadowRoot;
    const closeBtn = document.getElementById('modal-close-btn');
    const r = closeBtn?.getBoundingClientRect();
    if (!r) return null;
    const items = Array.from(shadow?.querySelectorAll('.hint-label') ?? []);
    for (const l of items) {
      const top = parseFloat((l as HTMLElement).style.top);
      const left = parseFloat((l as HTMLElement).style.left);
      if (Math.abs(top - r.top) < 10 && Math.abs(left - r.left) < 10) {
        return l.textContent?.trim();
      }
    }
    return null;
  });

  expect(closeHint).toBeTruthy();
  await page.keyboard.type(closeHint!);

  // Verify modal backdrop was removed
  await expect(page.locator('#test-modal-backdrop')).toHaveCount(0);
});
