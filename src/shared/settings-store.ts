import { defaults, migrateSettings, normalizeSettings } from './settings-schema';
import { assertValidSettings } from './validation';
import type { Settings } from './types';

const key = 'settings';

export async function loadSettings(): Promise<Settings> {
  if (typeof chrome === 'undefined' || !chrome.storage) return defaults();
  const [managed, sync, local] = await Promise.all([
    chrome.storage.managed?.get(key).catch(() => ({})) ?? Promise.resolve({}),
    chrome.storage.sync?.get(key).catch(() => ({})) ?? Promise.resolve({}),
    chrome.storage.local?.get(key).catch(() => ({})) ?? Promise.resolve({}),
  ]);
  const source = (managed as Record<string, unknown>)[key] ?? (sync as Record<string, unknown>)[key] ?? (local as Record<string, unknown>)[key];
  return migrateSettings(source);
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = normalizeSettings({ ...(await loadSettings()), ...patch });
  assertValidSettings(next);
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      await (chrome.storage.sync ?? chrome.storage.local).set({ [key]: next });
    } catch {
      await chrome.storage.local?.set({ [key]: next });
    }
  }
  return next;
}

export async function resetSettings(): Promise<Settings> {
  const next = defaults();
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      await (chrome.storage.sync ?? chrome.storage.local).set({ [key]: next });
    } catch {
      await chrome.storage.local?.set({ [key]: next });
    }
  }
  return next;
}

export function splitStorage(settings: Settings): { sync: Partial<Settings>; local: Partial<Settings> } {
  const { keyMappings, excludedPatterns, searchEngines, ...small } = settings;
  return { sync: small, local: { keyMappings, excludedPatterns, searchEngines } };
}
