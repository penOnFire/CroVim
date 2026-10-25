import { searchEngineForQuery } from './search-engines';
import { loadSettings } from '../shared/settings-store';

export interface Completion { title: string; url: string; source: 'tab' | 'history' | 'bookmark' | 'search'; score: number; match: number[] }
export function searchUrlForQuery(query: string, settings: Pick<import('../shared/types').Settings, 'searchEngines'>): string {
  const selected = searchEngineForQuery(query, settings);
  return selected
    ? selected.engine.url.replaceAll('%s', encodeURIComponent(selected.terms))
    : `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function score(text: string, query: string): { value: number; match: number[] } {
  const lower = text.toLowerCase(); const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  let value = 0; const match: number[] = [];
  for (const term of terms) {
    const index = lower.indexOf(term);
    if (index < 0) return { value: -Infinity, match: [] };
    value += index === 0 ? 40 : (/\W/.test(lower[index - 1] ?? '') ? 25 : 10);
    for (let i = index; i < index + term.length; i++) match.push(i);
  }
  return { value: value + Math.min(text.length, 100) / 100, match };
}

export async function complete(query: string): Promise<Completion[]> {
  const settings = await loadSettings();
  const [tabs, history, bookmarks] = await Promise.all([
    chrome.tabs.query({}),
    chrome.history.search({ text: query, maxResults: 30 }).catch(() => []),
    chrome.bookmarks.search({ query }).catch(() => []),
  ]);
  const raw: Completion[] = [
    ...tabs.filter((t) => t.url).map((t) => ({ title: t.title ?? '', url: t.url!, source: 'tab' as const, score: 0, match: [] })),
    ...history.filter((h) => h.url).map((h) => ({ title: h.title ?? '', url: h.url!, source: 'history' as const, score: 0, match: [] })),
    ...bookmarks.filter((b) => b.url).map((b) => ({ title: b.title ?? '', url: b.url!, source: 'bookmark' as const, score: 0, match: [] })),
  ];
  const deduped = new Map<string, Completion>();
  for (const item of raw) {
    const result = score(`${item.title} ${item.url}`, query);
    if (result.value === -Infinity) continue;
    const previous = deduped.get(item.url);
    if (!previous || result.value > previous.score) deduped.set(item.url, { ...item, ...result });
  }
  if (query.trim() && !/^https?:\/\//i.test(query)) {
    const searchUrl = searchUrlForQuery(query, settings);
    deduped.set(`search:${query}`, {
      title: `Search web for ${query}`, url: searchUrl,
      source: 'search', score: 1, match: [],
    });
  }
  return [...deduped.values()].sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, 30);
}
