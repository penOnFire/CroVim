import type { Settings } from './types';
import { DEFAULT_HINT_CHARACTERS } from './constants';

const mappings: Record<string, string> = {
  j: 'scrollDown', k: 'scrollUp', h: 'scrollLeft', l: 'scrollRight',
  d: 'halfPageDown', u: 'halfPageUp', gg: 'scrollTop', G: 'scrollBottom',
  zH: 'scrollLeftEdge', zL: 'scrollRightEdge',
  s: 'selectScroll', gs: 'selectScroll',
  F: 'enterHints', gf: 'enterHintsNewTab', yf: 'yankHint', gh: 'hoverHint', q: 'hoverHint', '/': 'find',
  n: 'findNext', N: 'findPrevious', v: 'visual', V: 'visualLine',
  i: 'insert', m: 'setMark', '`': 'gotoMark', "'": 'gotoMark', o: 'vomnibar',
  O: 'vomnibarCurrent', t: 'newTab', T: 'newTabBackground',
  b: 'backTab', B: 'forwardTab', '?': 'help', r: 'reload',
  R: 'hardReload', x: 'closeTab', X: 'restoreTab', gt: 'nextTab',
  gT: 'previousTab', g0: 'firstTab', 'g$': 'lastTab', gu: 'goUp',
  gU: 'goRoot', yy: 'yankUrl', p: 'openClipboard',
  P: 'openClipboardBackground', '<<': 'moveTabLeft', '>>': 'moveTabRight',
  J: 'moveTabRight', K: 'moveTabLeft', '^': 'visitPrevious',
  yt: 'yankTitle', gi: 'focusInput',
  '[[': 'previousPage', ']]': 'nextPage',
};

export const defaults = (): Settings => ({
  schemaVersion: 1, keyMappings: { ...mappings }, passKeys: [],
  excludedPatterns: [], searchEngines: [
    { keyword: 'g', name: 'Google', url: 'https://www.google.com/search?q=%s' },
    { keyword: 'ddg', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
  ],
  scrollStep: 400, smoothScroll: true, hintCharacters: DEFAULT_HINT_CHARACTERS,
  hintMode: 'alphabet', findRegex: false, findSmartCase: true, theme: 'system',
  globalMarksUseUppercase: true, newTabBackground: false,
});

const own = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizeSettings(input: unknown): Settings {
  const d = defaults();
  const x = own(input) ? input : {};
  const chars = typeof x.hintCharacters === 'string'
    ? [...new Set([...x.hintCharacters].filter((c) => c.trim() && !/\s/u.test(c)))].join('')
    : d.hintCharacters;
  const engines = Array.isArray(x.searchEngines) ? x.searchEngines
    .filter(own)
    .filter((e) => typeof e.keyword === 'string' && typeof e.name === 'string' && typeof e.url === 'string')
    .map((e) => ({ keyword: e.keyword as string, name: e.name as string, url: e.url as string })) : d.searchEngines;
  const customMappings = own(x.keyMappings)
    ? Object.fromEntries(Object.entries(x.keyMappings).filter(([key, command]) =>
      key.length > 0 && key.length <= 12 && typeof command === 'string' && command.length > 0))
    : {};
  if (customMappings.F === 'enterHintsNewTab') {
    customMappings.F = 'enterHints';
  }
  if (customMappings.f === 'enterHints') {
    delete customMappings.f;
  }
  return {
    ...d, ...x, schemaVersion: 1,
    keyMappings: {
      ...d.keyMappings,
      ...customMappings,
    },
    passKeys: Array.isArray(x.passKeys) ? [...new Set(x.passKeys.filter((v): v is string => typeof v === 'string'))] : d.passKeys,
    excludedPatterns: Array.isArray(x.excludedPatterns) ? x.excludedPatterns.filter((v): v is string => typeof v === 'string') : d.excludedPatterns,
    searchEngines: engines.length ? engines : d.searchEngines,
    hintCharacters: chars.length >= 2 ? chars : d.hintCharacters,
    scrollStep: typeof x.scrollStep === 'number' && Number.isFinite(x.scrollStep) ? Math.round(Math.min(2000, Math.max(10, x.scrollStep))) : d.scrollStep,
  } as Settings;
}

export function validateSettings(value: unknown): string[] {
  if (!own(value)) return ['Settings must be an object'];
  const x = normalizeSettings(value);
  const errors: string[] = [];
  if (x.hintCharacters.length < 2 || new Set(x.hintCharacters).size < 2) errors.push('Hint alphabet needs two unique characters');
  if (x.scrollStep < 10 || x.scrollStep > 2000) errors.push('Scroll step must be between 10 and 2000');
  if (!['alphabet', 'filtered'].includes(x.hintMode)) errors.push('Invalid hint mode');
  if (!['system', 'light', 'dark'].includes(x.theme)) errors.push('Invalid theme');
  const keywords = new Set<string>();
  for (const engine of x.searchEngines) {
    if (keywords.has(engine.keyword)) errors.push(`Duplicate search keyword: ${engine.keyword}`);
    keywords.add(engine.keyword);
    if (!/^[\w-]+$/u.test(engine.keyword) || !engine.url.includes('%s')) errors.push(`Search engine ${engine.name} must contain %s`);
  }
  for (const [key, command] of Object.entries(x.keyMappings)) {
    if (!key || key.length > 12 || !command) errors.push('Mappings must have non-empty keys and commands');
  }
  return errors;
}

export function migrateSettings(input: unknown): Settings {
  return normalizeSettings(input);
}
