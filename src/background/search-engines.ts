import type { Settings } from '../shared/types';

export interface SearchEngine { keyword: string; name: string; url: string }

export function validateSearchEngine(engine: SearchEngine): boolean {
  try {
    const parsed = new URL(engine.url.replace('%s', 'query'));
    return /^[\w-]+$/u.test(engine.keyword) && parsed.protocol === 'https:' && engine.url.includes('%s');
  } catch {
    return false;
  }
}

export function expandSearch(keyword: string, query: string, settings: Pick<Settings, 'searchEngines'>): string | null {
  const engine = settings.searchEngines.find((item) => item.keyword === keyword);
  return engine && validateSearchEngine(engine)
    ? engine.url.replaceAll('%s', encodeURIComponent(query.trim()))
    : null;
}

export function searchEngineForQuery(query: string, settings: Pick<Settings, 'searchEngines'>): { engine: SearchEngine; terms: string } | null {
  const [keyword, ...rest] = query.trim().split(/\s+/u);
  if (!keyword || rest.length === 0) return null;
  const engine = settings.searchEngines.find((item) => item.keyword === keyword);
  return engine && validateSearchEngine(engine) ? { engine, terms: rest.join(' ') } : null;
}
