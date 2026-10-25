import { describe, expect, it, vi } from 'vitest';
import { hierarchyUrl, supportedUrl } from '../../src/background/url-commands';

describe('URL commands', () => {
  it('recognizes supported browser URLs', () => {
    expect(supportedUrl('https://example.com')).toBe(true);
    expect(supportedUrl('http://example.com')).toBe(true);
    expect(supportedUrl('file:///tmp/example.html')).toBe(true);
    expect(supportedUrl('chrome://newtab/')).toBe(true);
    expect(supportedUrl('chrome://settings/')).toBe(false);
    expect(supportedUrl('javascript:alert(1)')).toBe(false);
  });

  it('computes the parent directory URL without query or hash', () => {
    expect(hierarchyUrl('https://example.com/a/b/page.html?x=1#section', false)).toBe('https://example.com/a/b/');
    expect(hierarchyUrl('https://example.com/a/b/page.html?x=1#section', true)).toBe('https://example.com/');
    expect(hierarchyUrl('https://example.com/page.html', false)).toBe('https://example.com/');
    expect(hierarchyUrl('https://example.com', false)).toBe('https://example.com/');
  });

  it('builds hierarchy through the active tab and opener', async () => {
    vi.stubGlobal('chrome', { tabs: { query: vi.fn().mockResolvedValue([{ id: 4, url: 'https://example.com/a/page?x=1#h' }]), update: vi.fn() } });
    const { hierarchy, open } = await import('../../src/background/url-commands');
    await hierarchy(false);
    expect(chrome.tabs.update).toHaveBeenCalledWith(4, { url: 'https://example.com/a/', active: true });
    vi.unstubAllGlobals();
    expect(open).toBeTypeOf('function');
  });
});
