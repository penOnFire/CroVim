import { describe, expect, it, vi } from 'vitest';
import { expandSearch, searchEngineForQuery, validateSearchEngine } from '../../src/background/search-engines';
import { formToSettings } from '../../src/pages/options/settings-form';
import { complete, searchUrlForQuery } from '../../src/background/vomnibar-search';

const settings = {
  searchEngines: [
    { keyword: 'g', name: 'Google', url: 'https://www.google.com/search?q=%s' },
    { keyword: 'gh', name: 'GitHub', url: 'https://github.com/search?q=%s' },
    { keyword: 'w', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search=%s' },
  ],
};

describe('search engines', () => {
  it('parses custom search engine form entries', () => {
    const form = document.createElement('form');
    form.innerHTML = `
      <input name="scrollStep" value="400"><input name="smoothScroll" type="checkbox">
      <input name="hintCharacters" value="asdf"><select name="hintMode"><option value="alphabet">alphabet</option></select>
      <input name="findRegex" type="checkbox"><input name="findSmartCase" type="checkbox">
      <select name="theme"><option value="system">system</option></select>
      <textarea name="keyMappings"></textarea><textarea name="excludedPatterns"></textarea>
      <textarea name="searchEngines">g=https://www.google.com/search?q=%s|Google\ncustom=https://example.com/?q=%s|Custom</textarea>`;
    expect(formToSettings(form).searchEngines).toEqual([
      { keyword: 'g', url: 'https://www.google.com/search?q=%s', name: 'Google' },
      { keyword: 'custom', url: 'https://example.com/?q=%s', name: 'Custom' },
    ]);
  });

  it('expands keyword searches and preserves encoded terms', () => {
    expect(searchEngineForQuery('gh open issues', settings)).toMatchObject({ engine: settings.searchEngines[1]!, terms: 'open issues' });
    expect(expandSearch('g', '  CroVim docs ', settings)).toBe('https://www.google.com/search?q=CroVim%20docs');
    expect(expandSearch('missing', 'query', settings)).toBeNull();
    expect(validateSearchEngine(settings.searchEngines[0]!)).toBe(true);
  });

  it('uses a custom engine or Google fallback URL', () => {
    expect(searchUrlForQuery('gh open issues', settings)).toBe('https://github.com/search?q=open%20issues');
    expect(searchUrlForQuery('plain query', settings)).toBe('https://www.google.com/search?q=plain%20query');
  });

  it('adds the fallback search result to completions', async () => {
    vi.stubGlobal('chrome', {
      tabs: { query: vi.fn().mockResolvedValue([]) },
      history: { search: vi.fn().mockResolvedValue([]) },
      bookmarks: { search: vi.fn().mockResolvedValue([]) },
      storage: {
        managed: { get: vi.fn().mockResolvedValue({}) },
        sync: { get: vi.fn().mockResolvedValue({}) },
        local: { get: vi.fn().mockResolvedValue({}) },
      },
    });
    const result = await complete('plain query');
    expect(result.find((item) => item.source === 'search')?.url).toBe('https://www.google.com/search?q=plain%20query');
    vi.unstubAllGlobals();
  });
});
