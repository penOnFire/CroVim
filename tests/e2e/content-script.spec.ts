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

test('selects explicit scroll containers and activates social reaction flyouts', async ({ context }) => {
  const page = await context.newPage();
  await page.goto('/rich.html');
  await page.waitForTimeout(300);

  // Setup multi-panel scroll layout and a Facebook-style reactions dock
  await page.evaluate(() => {
    const container = document.createElement('div');
    container.id = 'e2e-multi-panel-fixture';
    container.style.cssText = 'position:fixed;top:0;left:0;right:0;height:400px;background:#fff;z-index:9000;display:flex;gap:20px;padding:10px;box-sizing:border-box;';
    container.innerHTML = `
      <div id="side-panel" style="width:200px;height:350px;overflow-y:auto;background:#eee;border:1px solid #ccc;">
        <div style="height:1500px;padding:10px;">Sidebar tall content</div>
      </div>
      <div id="feed-panel" style="width:300px;height:350px;overflow-y:auto;background:#fafafa;border:1px solid #ccc;">
        <div style="height:2500px;padding:10px;">
          Feed tall content
          <div id="fb-post" style="margin-top:20px;padding:10px;border:1px solid #ddd;">
            <button id="fb-like-btn" aria-label="Like" style="padding:6px 12px;">Like</button>
            <div id="fb-reaction-dock" role="toolbar" aria-label="Reactions" style="display:none;margin-top:10px;padding:6px;background:#333;border-radius:20px;">
              <div role="button" aria-label="Like" id="fb-rx-like" style="display:inline-block;cursor:pointer;padding:4px 8px;color:#fff;">👍</div>
              <div role="button" aria-label="Love" id="fb-rx-love" style="display:inline-block;cursor:pointer;padding:4px 8px;color:#fff;"><span id="fb-rx-love-icon">❤️</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.prepend(container);

    // State tracking for reactions
    (window as any).selectedReaction = null;
    (window as any).reactionClicks = 0;

    const likeBtn = document.getElementById('fb-like-btn')!;
    const dock = document.getElementById('fb-reaction-dock')!;

    // Hovering the like button reveals the dock
    likeBtn.addEventListener('mouseover', () => { dock.style.display = 'inline-flex'; });
    likeBtn.addEventListener('pointerover', () => { dock.style.display = 'inline-flex'; });

    // Delegated click handler on document
    document.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('[role="button"]');
      if (btn && (btn.id === 'fb-rx-like' || btn.id === 'fb-rx-love')) {
        (window as any).reactionClicks++;
        if ((window as any).selectedReaction === btn.id) {
          (window as any).selectedReaction = null; // Toggle off if clicked again!
        } else {
          (window as any).selectedReaction = btn.id;
        }
      }
    });
  });

  // 1. Test selecting explicit scroll container via 's'
  await page.keyboard.press('s');
  await page.waitForTimeout(200);

  // Find hint for #side-panel
  const sideHint = await page.evaluate(() => {
    const root = document.getElementById('crovim-ui-root');
    const shadow = root?.shadowRoot;
    const side = document.getElementById('side-panel');
    const r = side?.getBoundingClientRect();
    if (!r) return null;
    const items = Array.from(shadow?.querySelectorAll('.hint-label') ?? []);
    for (const l of items) {
      const top = parseFloat((l as HTMLElement).style.top);
      const left = parseFloat((l as HTMLElement).style.left);
      if (Math.abs(top - (r.top + 8)) < 15 && Math.abs(left - (r.left + 8)) < 15) {
        return l.textContent?.trim();
      }
    }
    return null;
  });

  expect(sideHint).toBeTruthy();
  await page.keyboard.type(sideHint!);
  await page.waitForTimeout(100);

  // Scroll down multiple times
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await page.keyboard.press('j');
  await page.waitForTimeout(300);

  const scrollPositions = await page.evaluate(() => ({
    sideTop: document.getElementById('side-panel')?.scrollTop ?? 0,
    feedTop: document.getElementById('feed-panel')?.scrollTop ?? 0,
  }));

  expect(scrollPositions.sideTop).toBeGreaterThan(0);
  expect(scrollPositions.feedTop).toBe(0);

  // 2. Test hover hint 'q' (or 'gh') to reveal Facebook reaction dock
  await page.keyboard.press('q');
  await page.waitForTimeout(200);

  const likeHint = await page.evaluate(() => {
    const root = document.getElementById('crovim-ui-root');
    const shadow = root?.shadowRoot;
    const btn = document.getElementById('fb-like-btn');
    const r = btn?.getBoundingClientRect();
    if (!r) return null;
    const items = Array.from(shadow?.querySelectorAll('.hint-label') ?? []);
    for (const l of items) {
      const top = parseFloat((l as HTMLElement).style.top);
      const left = parseFloat((l as HTMLElement).style.left);
      if (Math.abs(top - r.top) < 15 && Math.abs(left - r.left) < 15) {
        return l.textContent?.trim();
      }
    }
    return null;
  });

  expect(likeHint).toBeTruthy();
  await page.keyboard.type(likeHint!);
  await page.waitForTimeout(200);

  // Dock should now be visible
  await expect(page.locator('#fb-reaction-dock')).toBeVisible();

  // 3. Test clicking reaction 'fb-rx-love' via Shift+F
  await page.keyboard.press('Shift+F');
  await page.waitForTimeout(200);

  const loveHint = await page.evaluate(() => {
    const root = document.getElementById('crovim-ui-root');
    const shadow = root?.shadowRoot;
    const love = document.getElementById('fb-rx-love');
    const r = love?.getBoundingClientRect();
    if (!r) return null;
    const items = Array.from(shadow?.querySelectorAll('.hint-label') ?? []);
    for (const l of items) {
      const top = parseFloat((l as HTMLElement).style.top);
      const left = parseFloat((l as HTMLElement).style.left);
      if (Math.abs(top - r.top) < 15 && Math.abs(left - r.left) < 15) {
        return l.textContent?.trim();
      }
    }
    return null;
  });

  expect(loveHint).toBeTruthy();
  await page.keyboard.type(loveHint!);

  // Verify 'fb-rx-love' was selected and click count is exactly 1 (not toggled off by duplicate click)
  await expect.poll(() => page.evaluate(() => (window as any).selectedReaction)).toBe('fb-rx-love');
  await expect.poll(() => page.evaluate(() => (window as any).reactionClicks)).toBe(1);
});
